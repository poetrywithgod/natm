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
  is_paid: boolean;
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
    .select("id, name, amount, class_id, term_id, created_at, classes(name)")
    .eq("school_id", schoolId)
    .eq("term_id", termId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((f) => {
    const classInfo = f.classes as unknown as { name: string } | null;
    return {
      id: f.id,
      name: f.name,
      amount: f.amount,
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
export async function createFeeType(
  schoolId: string,
  termId: string,
  name: string,
  amount: number,
  classId: string | null,
  actorId: string
): Promise<void> {
  const { data: feeType, error: feeTypeError } = await supabase
    .from("fee_types")
    .insert({ school_id: schoolId, term_id: termId, name, amount, class_id: classId })
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
    details: { name, amount, class_id: classId },
  });

  if (!students || students.length === 0) return;

  const rows = students.map((s) => ({
    school_id: schoolId,
    student_id: s.id,
    term_id: termId,
    fee_type_id: feeType.id,
    amount_due: amount,
    amount_paid: 0,
  }));

  const { error: insertError } = await supabase
    .from("student_fees")
    .upsert(rows, { onConflict: "student_id,fee_type_id" });
  if (insertError) throw new Error(insertError.message);
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
}
