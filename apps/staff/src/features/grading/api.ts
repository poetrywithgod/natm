import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

export interface CurrentQuarter {
  year: number;
  quarterNumber: 1 | 2 | 3 | 4;
  startDate: string; // ISO date
  endDate: string;   // ISO date, exclusive
}

// Literal calendar quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec), independent
// of the school's 3-term academic year -- matches the Foundation donation
// cadence decision.
export function getCurrentQuarter(): CurrentQuarter {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const quarterNumber = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  const startMonth = (quarterNumber - 1) * 3;
  const startDate = new Date(year, startMonth, 1).toISOString().slice(0, 10);
  const endDate = new Date(year, startMonth + 3, 1).toISOString().slice(0, 10);
  return { year, quarterNumber, startDate, endDate };
}

export interface SubjectProgress {
  subject_id: string;
  subject_name: string;
  currentQuarterAverage: number | null; // percentage, 0-100, null if no attempts yet
  currentQuarterAttemptCount: number;
  lastFinalizedScore: number | null;
  lastFinalizedQuarter: { year: number; quarterNumber: number } | null;
}

// Per-subject progress for one student: the running average of every
// submitted quiz attempt so far this quarter, plus the most recent
// finalized quarterly score if one exists.
export async function fetchSubjectProgress(
  studentId: string,
  classId: string
): Promise<SubjectProgress[]> {
  const { data: classSubjects, error: subjError } = await supabase
    .from("class_subjects")
    .select("subject_id, subject:subjects(id, name)")
    .eq("class_id", classId);
  if (subjError) throw new Error(subjError.message);

  const quarter = getCurrentQuarter();

  const { data: attempts, error: attemptsError } = await supabase
    .from("quiz_attempts")
    .select("score, total_marks, submitted_at, quiz:quizzes(lesson:lessons(subject_id))")
    .eq("student_id", studentId)
    .eq("status", "submitted")
    .gte("submitted_at", quarter.startDate)
    .lt("submitted_at", quarter.endDate);
  if (attemptsError) throw new Error(attemptsError.message);

  const { data: finalized, error: finalizedError } = await supabase
    .from("quarterly_subject_scores")
    .select("subject_id, average_score, year, quarter_number")
    .eq("student_id", studentId)
    .order("year", { ascending: false })
    .order("quarter_number", { ascending: false });
  if (finalizedError) throw new Error(finalizedError.message);

  return (classSubjects as any[]).map((cs) => {
    const subjectAttempts = (attempts as any[]).filter(
      (a) => a.quiz?.lesson?.subject_id === cs.subject_id && a.total_marks > 0
    );
    const percentages = subjectAttempts.map((a) => (a.score / a.total_marks) * 100);
    const currentQuarterAverage =
      percentages.length > 0 ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length : null;

    const lastFinalized = (finalized as any[]).find((f) => f.subject_id === cs.subject_id);

    return {
      subject_id: cs.subject_id,
      subject_name: cs.subject.name,
      currentQuarterAverage,
      currentQuarterAttemptCount: percentages.length,
      lastFinalizedScore: lastFinalized?.average_score ?? null,
      lastFinalizedQuarter: lastFinalized
        ? { year: lastFinalized.year, quarterNumber: lastFinalized.quarter_number }
        : null,
    };
  });
}

// Computes and stores the finalized quarterly score for every student in
// the school, per subject, from this quarter's submitted quiz attempts.
// Client-side aggregation (school-scoped, so dataset stays modest) rather
// than a database function, for straightforward review/debugging.
export async function finalizeCurrentQuarter(schoolId: string, actorId: string): Promise<number> {
  const quarter = getCurrentQuarter();

  const { data: schoolQuizzes, error: quizzesError } = await supabase
    .from("quizzes")
    .select("id, lesson:lessons(subject_id)")
    .eq("school_id", schoolId);
  if (quizzesError) throw new Error(quizzesError.message);

  const quizIdToSubject = new Map<string, string>();
  (schoolQuizzes as any[]).forEach((q) => {
    if (q.lesson?.subject_id) quizIdToSubject.set(q.id, q.lesson.subject_id);
  });
  const quizIds = Array.from(quizIdToSubject.keys());
  if (quizIds.length === 0) return 0;

  const { data: attempts, error: attemptsError } = await supabase
    .from("quiz_attempts")
    .select("student_id, quiz_id, score, total_marks, submitted_at")
    .in("quiz_id", quizIds)
    .eq("status", "submitted")
    .gte("submitted_at", quarter.startDate)
    .lt("submitted_at", quarter.endDate);
  if (attemptsError) throw new Error(attemptsError.message);

  // Group by "student_id|subject_id" -> list of percentages
  const groups = new Map<string, number[]>();
  (attempts as any[]).forEach((a) => {
    if (!a.total_marks || a.total_marks <= 0) return;
    const subjectId = quizIdToSubject.get(a.quiz_id);
    if (!subjectId) return;
    const key = `${a.student_id}|${subjectId}`;
    const pct = (a.score / a.total_marks) * 100;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(pct);
  });

  const rows = Array.from(groups.entries()).map(([key, percentages]) => {
    const [studentId, subjectId] = key.split("|");
    const average = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
    return {
      student_id: studentId,
      subject_id: subjectId,
      school_id: schoolId,
      year: quarter.year,
      quarter_number: quarter.quarterNumber,
      average_score: average,
      attempt_count: percentages.length,
      finalized_by: actorId,
    };
  });

  if (rows.length === 0) return 0;

  const { error: upsertError } = await supabase
    .from("quarterly_subject_scores")
    .upsert(rows, { onConflict: "student_id,subject_id,year,quarter_number" });
  if (upsertError) throw new Error(upsertError.message);

  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "quarter.finalized",
    entity_type: "school",
    entity_id: schoolId,
    details: { year: quarter.year, quarter_number: quarter.quarterNumber, rows_written: rows.length },
  });

  return rows.length;
}
