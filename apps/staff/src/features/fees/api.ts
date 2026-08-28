import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

export interface CurrentTerm {
  id: string;
  term_number: number;
  session_name: string;
}

export interface FeeType {
  id: string;
  name: string;
  amount: number;
  is_open_amount: boolean;
  class_id: string | null;
  class_name: string | null; // null = whole school
  term_id: string;
  created_at: string;
}

export interface StudentFeeRow {
  student_id: string;
  full_name: string;
  class_id: string | null;
  class_name: string | null;
  fee_id: string;
  amount_due: number;
  amount_paid: number;
  is_paid: boolean | null;
}

export async function fetchCurrentTerm(schoolId: string): Promise<CurrentTerm | null> {
  const { data: session, error: sessionError } = await supabase
    .from("academic_sessions")
    .select("id, name")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return null;

  const { data: term, error: termError } = await supabase
    .from("terms")
    .select("id, term_number")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  if (termError) throw new Error(termError.message);
  if (!term) return null;

  return { id: term.id, term_number: term.term_number, session_name: session.name };
}

export async function fetchFeeTypes(schoolId: string, termId: string): Promise<FeeType[]> {
  const { data, error } = await supabase
    .from("fee_types")
    .select("id, name, amount, is_open_amount, class_id, term_id, created_at, classes(name)")
    .eq("school_id", schoolId)
    .eq("term_id", termId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((f) => {
    const classInfo = f.classes as unknown as { name: string } | null;
    return {
      id: f.id,
      name: f.name,
      amount: f.amount,
      is_open_amount: f.is_open_amount,
      class_id: f.class_id,
      class_name: classInfo?.name ?? null,
      term_id: f.term_id,
      created_at: f.created_at,
    };
  });
}

// Creates the fee type, then generates a student_fees row for every
// applicable student (whole school if classId is null, otherwise just
// that class) so paid/unpaid tracking for this fee starts immediately.
// isOpenAmount marks an item as having no fixed target (used for
// Partnership-model items like Child Developmental Support, where the
// actual amount depends entirely on the partner's tier) -- amount is
// forced to 0 and student_fees rows are seeded at 0/0, since there's
// nothing to be "due".
export async function createFeeType(
  schoolId: string,
  termId: string,
  name: string,
  amount: number,
  classId: string | null,
  actorId: string,
  isOpenAmount = false
): Promise<void> {
  const effectiveAmount = isOpenAmount ? 0 : amount;
  const { data: feeType, error: feeTypeError } = await supabase
    .from("fee_types")
    .insert({
      school_id: schoolId,
      term_id: termId,
      name,
      amount: effectiveAmount,
      class_id: classId,
      is_open_amount: isOpenAmount,
    })
    .select()
    .single();
  if (feeTypeError) throw new Error(feeTypeError.message);

  let studentQuery = supabase.from("students").select("id").eq("school_id", schoolId);
  if (classId) studentQuery = studentQuery.eq("class_id", classId);
  const { data: students, error: studentsError } = await studentQuery;
  if (studentsError) throw new Error(studentsError.message);

  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "fee_type.created",
    entity_type: "fee_type",
    entity_id: feeType.id,
    details: { name, amount: effectiveAmount, class_id: classId, is_open_amount: isOpenAmount },
  });

  if (!students || students.length === 0) return;

  const rows = students.map((s) => ({
    school_id: schoolId,
    student_id: s.id,
    term_id: termId,
    fee_type_id: feeType.id,
    amount_due: effectiveAmount,
    amount_paid: 0,
  }));

  const { error: insertError } = await supabase
    .from("student_fees")
    .upsert(rows, { onConflict: "student_id,fee_type_id" });
  if (insertError) throw new Error(insertError.message);
}

// Under the Partnership model, every term should have a standing
// "Child Developmental Support" item so parents always have somewhere
// to contribute -- Finance Manager shouldn't have to remember to
// re-create it each term. Idempotent: checks for an existing active
// (non-archived) one first, so calling this on every page load under
// Partnership is safe.
export async function ensureQuarterlyCDS(schoolId: string, termId: string, actorId: string): Promise<void> {
  const { data: existing, error } = await supabase
    .from("fee_types")
    .select("id")
    .eq("school_id", schoolId)
    .eq("term_id", termId)
    .eq("is_archived", false)
    .ilike("name", "Child Developmental Support")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return;

  await createFeeType(schoolId, termId, "Child Developmental Support", 0, null, actorId, true);
}

// Hides a fee/support item going forward (Finance Manager list, School Admin
// views, and parents' fees-due lists all filter on is_archived=false) without
// touching any existing student_fees or payment_transactions rows -- payment
// history for it stays intact and queryable, it just stops being collected
// against or shown as active.
export async function archiveFeeType(feeTypeId: string, schoolId: string, actorId: string): Promise<void> {
  const { error } = await supabase.from("fee_types").update({ is_archived: true }).eq("id", feeTypeId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "fee_type.archived",
    entity_type: "fee_type",
    entity_id: feeTypeId,
    details: {},
  });
}

export interface PartnershipTierStat {
  tier: "gold" | "silver" | "bronze";
  label: string;
  count: number;
  totalAmount: number;
}

// Combines the two places tier choices live: payment_transactions for
// Gold/Silver (monetary, tier stored alongside the amount) and
// partnership_pledges for Bronze (non-monetary, no amount column at
// all -- see the partnership_tiers_v2 migration for why). All-time,
// not scoped to the current term, since which tier partners gravitate
// to is a longer-running signal than a single term's collection.
export async function fetchPartnershipTierStats(schoolId: string): Promise<PartnershipTierStat[]> {
  const [{ data: txns, error: txnsError }, { data: pledges, error: pledgesError }] = await Promise.all([
    supabase
      .from("payment_transactions")
      .select("partnership_tier, amount")
      .eq("school_id", schoolId)
      .not("partnership_tier", "is", null),
    supabase.from("partnership_pledges").select("id").eq("school_id", schoolId),
  ]);
  if (txnsError) throw new Error(txnsError.message);
  if (pledgesError) throw new Error(pledgesError.message);

  const gold = (txns ?? []).filter((t) => t.partnership_tier === "gold");
  const silver = (txns ?? []).filter((t) => t.partnership_tier === "silver");

  return [
    {
      tier: "gold",
      label: "Gold",
      count: gold.length,
      totalAmount: gold.reduce((sum, t) => sum + t.amount, 0),
    },
    {
      tier: "silver",
      label: "Silver",
      count: silver.length,
      totalAmount: silver.reduce((sum, t) => sum + t.amount, 0),
    },
    {
      tier: "bronze",
      label: "Bronze",
      count: (pledges ?? []).length,
      totalAmount: 0,
    },
  ];
}

export async function fetchStudentFeeRowsForType(feeTypeId: string): Promise<StudentFeeRow[]> {
  const { data, error } = await supabase
    .from("student_fees")
    .select("id, student_id, amount_due, amount_paid, is_paid, students(full_name, class_id, classes(name))")
    .eq("fee_type_id", feeTypeId);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((f) => {
    const student = f.students as unknown as {
      full_name: string;
      class_id: string | null;
      classes: { name: string } | null;
    } | null;
    return {
      student_id: f.student_id,
      full_name: student?.full_name ?? "Unknown",
      class_id: student?.class_id ?? null,
      class_name: student?.classes?.name ?? null,
      fee_id: f.id,
      amount_due: f.amount_due,
      amount_paid: f.amount_paid,
      is_paid: f.is_paid,
    };
  });

  return rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export interface FeeTypeSummary {
  fee_type_id: string;
  fee_type_name: string;
  total_due: number;
  total_paid: number;
}

// Aggregates every student_fees row for the term, grouped by fee type --
// used for the Finance Manager dashboard chart.
export async function fetchFeesSummary(schoolId: string, termId: string): Promise<FeeTypeSummary[]> {
  const { data, error } = await supabase
    .from("student_fees")
    .select("amount_due, amount_paid, fee_type:fee_types!inner(id, name, is_archived)")
    .eq("school_id", schoolId)
    .eq("term_id", termId)
    .eq("fee_type.is_archived", false);
  if (error) throw new Error(error.message);

  const totals = new Map<string, FeeTypeSummary>();
  for (const row of (data ?? []) as any[]) {
    const ft = row.fee_type;
    if (!ft) continue;
    const entry = totals.get(ft.id) ?? {
      fee_type_id: ft.id,
      fee_type_name: ft.name,
      total_due: 0,
      total_paid: 0,
    };
    entry.total_due += row.amount_due;
    entry.total_paid += row.amount_paid;
    totals.set(ft.id, entry);
  }

  return Array.from(totals.values());
}

export async function upsertStudentFee(
  schoolId: string,
  studentId: string,
  feeTypeId: string,
  termId: string,
  amountDue: number,
  amountPaid: number,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("student_fees").upsert(
    {
      school_id: schoolId,
      student_id: studentId,
      term_id: termId,
      fee_type_id: feeTypeId,
      amount_due: amountDue,
      amount_paid: amountPaid,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,fee_type_id" }
  );
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "fee.payment_recorded",
    entity_type: "student",
    entity_id: studentId,
    details: { fee_type_id: feeTypeId, amount_due: amountDue, amount_paid: amountPaid },
  });

  if (amountPaid > 0) {
    await notifyFinanceManagersOfPayment(schoolId, studentId, feeTypeId, amountPaid, actorId);
  }
}

// Notifies every other active Finance Manager at the school when a payment is
// recorded -- excludes the person who recorded it. Fire-and-forget push
// delivery follows the same pattern as classwork's Assign Work notifications.
async function notifyFinanceManagersOfPayment(
  schoolId: string,
  studentId: string,
  feeTypeId: string,
  amountPaid: number,
  actorId: string
): Promise<void> {
  const [{ data: student }, { data: feeType }, { data: recipients }] = await Promise.all([
    supabase.from("students").select("full_name").eq("id", studentId).single(),
    supabase.from("fee_types").select("name").eq("id", feeTypeId).single(),
    supabase
      .from("profiles")
      .select("id")
      .eq("school_id", schoolId)
      .eq("role", "finance_manager")
      .eq("is_active", true)
      .neq("id", actorId),
  ]);

  if (!recipients || recipients.length === 0) return;

  const studentName = student?.full_name ?? "A student";
  const feeTypeName = feeType?.name ?? "a fee";
  const formattedAmount = `₦${amountPaid.toLocaleString()}`;

  const notificationRows = recipients.map((r) => ({
    school_id: schoolId,
    recipient_id: r.id,
    type: "payment_recorded",
    title: "Payment recorded",
    body: `${studentName} paid ${formattedAmount} towards ${feeTypeName}.`,
    related_entity_type: "student_fees",
    related_entity_id: studentId,
  }));

  const { error: notifyError } = await supabase.from("notifications").insert(notificationRows);
  if (notifyError) throw new Error(notifyError.message);

  supabase.functions.invoke("send-push", { body: {} }).catch((err) => {
    console.error("send-push invoke failed:", err);
  });
}

export interface ClassFeeBreakdown {
  class_id: string | null;
  class_name: string;
  total_students: number;
  paid_students: number;
}

// Groups a fee type's student rows (from fetchStudentFeeRowsForType) by class --
// used for the Finance Manager dashboard's per-class collection breakdown.
export function summarizeByClass(rows: StudentFeeRow[]): ClassFeeBreakdown[] {
  const map = new Map<string, ClassFeeBreakdown>();
  for (const r of rows) {
    const key = r.class_id ?? "unassigned";
    const entry = map.get(key) ?? {
      class_id: r.class_id,
      class_name: r.class_name ?? "No Class",
      total_students: 0,
      paid_students: 0,
    };
    entry.total_students += 1;
    if (r.is_paid) entry.paid_students += 1;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => a.class_name.localeCompare(b.class_name));
}

// Sums amount_paid across every student_fees row whose term falls within the given
// calendar year, bucketed by each term's start_date (a term is credited to the year
// its start_date falls in -- reasonable since NATM terms don't straddle Dec 31/Jan 1
// under the standard Sep-Jul academic calendar). Terms without dates set are excluded.
export async function fetchAnnualRevenue(schoolId: string, year: number): Promise<number> {
  const { data: sessions, error: sessionsError } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId);
  if (sessionsError) throw new Error(sessionsError.message);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return 0;

  const { data: terms, error: termsError } = await supabase
    .from("terms")
    .select("id")
    .in("session_id", sessionIds)
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`);
  if (termsError) throw new Error(termsError.message);
  const termIds = (terms ?? []).map((t) => t.id);
  if (termIds.length === 0) return 0;

  const { data: fees, error: feesError } = await supabase
    .from("student_fees")
    .select("amount_paid")
    .eq("school_id", schoolId)
    .in("term_id", termIds);
  if (feesError) throw new Error(feesError.message);

  return (fees ?? []).reduce((sum, f) => sum + f.amount_paid, 0);
}
