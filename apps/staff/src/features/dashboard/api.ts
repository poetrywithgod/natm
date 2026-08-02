import { supabase } from "../../lib/supabase";
import { fetchCurrentTerm } from "../fees/api";

export interface DashboardSummary {
  classCount: number;
  studentCount: number;
  staffCount: number;
  currentSessionName: string | null;
  currentTermNumber: number | null;
}

export interface AttendanceDayPoint {
  date: string; // YYYY-MM-DD
  present: number;
  absent: number;
  late: number;
}

export interface ClassDistributionPoint {
  className: string;
  studentCount: number;
}

export interface FeeSummary {
  paid: number;
  unpaid: number;
}

export interface ClassFeeStat {
  className: string;
  paid: number;
  unpaid: number;
}

export async function fetchDashboardSummary(schoolId: string): Promise<DashboardSummary> {
  const [classesRes, studentsRes, staffRes, sessionRes] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .in("role", ["class_teacher", "shadow_teacher", "finance_manager"]),
    supabase
      .from("academic_sessions")
      .select("id, name")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  if (classesRes.error) throw new Error(classesRes.error.message);
  if (studentsRes.error) throw new Error(studentsRes.error.message);
  if (staffRes.error) throw new Error(staffRes.error.message);
  if (sessionRes.error) throw new Error(sessionRes.error.message);

  let currentTermNumber: number | null = null;
  if (sessionRes.data) {
    const { data: term, error: termError } = await supabase
      .from("terms")
      .select("term_number")
      .eq("session_id", sessionRes.data.id)
      .eq("is_current", true)
      .maybeSingle();
    if (termError) throw new Error(termError.message);
    currentTermNumber = term?.term_number ?? null;
  }

  return {
    classCount: classesRes.count ?? 0,
    studentCount: studentsRes.count ?? 0,
    staffCount: staffRes.count ?? 0,
    currentSessionName: sessionRes.data?.name ?? null,
    currentTermNumber,
  };
}

export async function fetchAttendanceTrend(schoolId: string): Promise<AttendanceDayPoint[]> {
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id")
    .eq("school_id", schoolId);
  if (classesError) throw new Error(classesError.message);

  const classIds = (classes ?? []).map((c) => c.id);

  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  if (classIds.length === 0) {
    return days.map((date) => ({ date, present: 0, absent: 0, late: 0 }));
  }

  const { data: records, error: attendanceError } = await supabase
    .from("attendance")
    .select("date, status")
    .in("class_id", classIds)
    .gte("date", days[0]);
  if (attendanceError) throw new Error(attendanceError.message);

  return days.map((date) => {
    const dayRecords = (records ?? []).filter((r) => r.date === date);
    return {
      date,
      present: dayRecords.filter((r) => r.status === "present").length,
      absent: dayRecords.filter((r) => r.status === "absent").length,
      late: dayRecords.filter((r) => r.status === "late").length,
    };
  });
}

export async function fetchClassDistribution(schoolId: string): Promise<ClassDistributionPoint[]> {
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (classesError) throw new Error(classesError.message);

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId);
  if (studentsError) throw new Error(studentsError.message);

  return (classes ?? []).map((c) => ({
    className: c.name,
    studentCount: (students ?? []).filter((s) => s.class_id === c.id).length,
  }));
}

// Counts actual fee billings (student_fees rows) for the current term,
// across all fee types combined — not "total students minus paid",
// since a student can now have zero, one, or several distinct fees
// (School Fees, PTA Fees, etc.) each tracked independently. A student
// with no billing at all for a given fee simply isn't counted here.
export async function fetchFeeSummary(schoolId: string): Promise<FeeSummary> {
  const term = await fetchCurrentTerm(schoolId);
  if (!term) return { paid: 0, unpaid: 0 };

  const { data: fees, error: feesError } = await supabase
    .from("student_fees")
    .select("is_paid")
    .eq("school_id", schoolId)
    .eq("term_id", term.id);
  if (feesError) throw new Error(feesError.message);

  const paid = (fees ?? []).filter((f) => f.is_paid).length;
  const unpaid = (fees ?? []).filter((f) => !f.is_paid).length;
  return { paid, unpaid };
}

export async function fetchFeeByClass(schoolId: string): Promise<ClassFeeStat[]> {
  const term = await fetchCurrentTerm(schoolId);

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (classesError) throw new Error(classesError.message);

  if (!term) {
    return (classes ?? []).map((c) => ({ className: c.name, paid: 0, unpaid: 0 }));
  }

  const { data: fees, error: feesError } = await supabase
    .from("student_fees")
    .select("is_paid, students(class_id)")
    .eq("school_id", schoolId)
    .eq("term_id", term.id);
  if (feesError) throw new Error(feesError.message);

  return (classes ?? []).map((c) => {
    const classFees = (fees ?? []).filter((f) => {
      const student = f.students as unknown as { class_id: string | null } | null;
      return student?.class_id === c.id;
    });
    return {
      className: c.name,
      paid: classFees.filter((f) => f.is_paid).length,
      unpaid: classFees.filter((f) => !f.is_paid).length,
    };
  });
}
