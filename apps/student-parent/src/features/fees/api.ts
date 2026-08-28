import { supabase } from "../../lib/supabase";

export interface ChildFeeRow {
  student_fee_id: string;
  student_id: string;
  full_name: string;
  fee_type_id: string;
  fee_type_name: string;
  term_id: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
}

// Fetches every fee_types row applicable to each of the parent's linked
// children for the school's current term, joined with (or defaulted from,
// if no student_fees row exists yet -- "not yet billed") their payment
// progress so far.
export async function fetchChildrenFeesDue(parentId: string): Promise<ChildFeeRow[]> {
  const { data: links, error: linksError } = await supabase
    .from("parent_student_links")
    .select("students(id, full_name, school_id, class_id)")
    .eq("parent_id", parentId);
  if (linksError) throw new Error(linksError.message);

  const children = (links ?? [])
    .map((row) => (Array.isArray(row.students) ? row.students[0] : row.students))
    .filter((s): s is { id: string; full_name: string; school_id: string; class_id: string | null } => !!s);
  if (children.length === 0) return [];

  const schoolId = children[0].school_id;

  const { data: session, error: sessionError } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return [];

  const { data: term, error: termError } = await supabase
    .from("terms")
    .select("id")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  if (termError) throw new Error(termError.message);
  if (!term) return [];

  const rows: ChildFeeRow[] = [];

  for (const child of children) {
    const { data: feeTypes, error: feeTypesError } = await supabase
      .from("fee_types")
      .select("id, name, amount, class_id")
      .eq("school_id", schoolId)
      .eq("term_id", term.id)
      .eq("is_archived", false);
    if (feeTypesError) throw new Error(feeTypesError.message);

    const applicable = (feeTypes ?? []).filter((f) => f.class_id === null || f.class_id === child.class_id);
    if (applicable.length === 0) continue;

    const { data: existingRows, error: existingError } = await supabase
      .from("student_fees")
      .select("id, fee_type_id, amount_due, amount_paid")
      .eq("student_id", child.id)
      .eq("term_id", term.id);
    if (existingError) throw new Error(existingError.message);

    const byFeeType = new Map((existingRows ?? []).map((r) => [r.fee_type_id, r]));

    for (const feeType of applicable) {
      const existing = byFeeType.get(feeType.id);
      const amountDue = existing?.amount_due ?? feeType.amount;
      const amountPaid = existing?.amount_paid ?? 0;
      // Skip fees this child hasn't actually been billed for yet — the
      // Finance Manager's createFeeType flow generates a student_fees row
      // for every applicable student, so a missing row here would be an
      // edge case (e.g. student added after the fee type was created).
      if (!existing) continue;
      rows.push({
        student_fee_id: existing.id,
        student_id: child.id,
        full_name: child.full_name,
        fee_type_id: feeType.id,
        fee_type_name: feeType.name,
        term_id: term.id,
        amount_due: amountDue,
        amount_paid: amountPaid,
        balance: amountDue - amountPaid,
      });
    }
  }

  return rows;
}

export type PartnershipTier = "gold" | "silver" | "resource_men_support";

export interface InitiatePaymentResult {
  rrr: string;
  order_id: string;
  public_key: string;
  amount: number;
  payer_name: string;
  payer_email: string;
}

export async function initiateRemitaPayment(
  studentFeeId: string,
  amount: number,
  partnershipTier?: PartnershipTier | null
): Promise<InitiatePaymentResult> {
  const { data, error } = await supabase.functions.invoke("initiate-remita-payment", {
    body: { student_fee_id: studentFeeId, amount, partnership_tier: partnershipTier ?? null },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as InitiatePaymentResult;
}

export interface PaymentHistoryRow {
  id: string;
  student_name: string;
  fee_type_name: string;
  amount: number;
  status: string;
  created_at: string;
}

export async function fetchOwnPaymentHistory(parentId: string): Promise<PaymentHistoryRow[]> {
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("id, amount, status, created_at, students(full_name), fee_types(name)")
    .eq("initiated_by", parentId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    const feeType = Array.isArray(row.fee_types) ? row.fee_types[0] : row.fee_types;
    return {
      id: row.id,
      student_name: student?.full_name ?? "—",
      fee_type_name: feeType?.name ?? "—",
      amount: row.amount,
      status: row.status,
      created_at: row.created_at,
    };
  });
}
