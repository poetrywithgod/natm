import { supabase } from "../../lib/supabase";

export type AttemptStatus = "not_started" | "in_progress" | "submitted";

export interface StudentAssignment {
  classWorkId: string;
  quizId: string;
  dueDate: string | null;
  difficulty: "easy" | "normal" | "hard";
  lessonTitle: string;
  subjectName: string | null;
  attemptStatus: AttemptStatus;
  score: number | null;
}

interface ClassWorkRow {
  id: string;
  due_date: string | null;
  quiz_id: string;
  quizzes: {
    id: string;
    difficulty: "easy" | "normal" | "hard";
    lessons: {
      title: string;
      subjects: { name: string } | null;
    } | null;
  } | null;
}

export async function fetchStudentAssignments(
  studentId: string,
  classId: string
): Promise<StudentAssignment[]> {
  const { data: classWork, error: cwError } = await supabase
    .from("class_work")
    .select(
      "id, due_date, quiz_id, quizzes(id, difficulty, lessons(title, subjects(name)))"
    )
    .eq("class_id", classId)
    .order("due_date", { ascending: true });
  if (cwError) throw new Error(cwError.message);

  const rows = (classWork ?? []) as unknown as ClassWorkRow[];
  if (rows.length === 0) return [];

  const classWorkIds = rows.map((r) => r.id);

  const { data: assignees, error: assigneeError } = await supabase
    .from("class_work_assignees")
    .select("class_work_id, student_id")
    .in("class_work_id", classWorkIds);
  if (assigneeError) throw new Error(assigneeError.message);

  // A class_work item with NO assignee rows at all means "whole class".
  // One with assignee rows only applies if this student is among them.
  const restrictedIds = new Set((assignees ?? []).map((a) => a.class_work_id));
  const myIds = new Set(
    (assignees ?? []).filter((a) => a.student_id === studentId).map((a) => a.class_work_id)
  );

  const visible = rows.filter((r) => !restrictedIds.has(r.id) || myIds.has(r.id));
  if (visible.length === 0) return [];

  const quizIds = visible.map((r) => r.quiz_id);
  const { data: attempts, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select("quiz_id, status, score")
    .eq("student_id", studentId)
    .in("quiz_id", quizIds);
  if (attemptError) throw new Error(attemptError.message);

  const attemptByQuiz = new Map((attempts ?? []).map((a) => [a.quiz_id, a]));

  return visible.map((r) => {
    const attempt = attemptByQuiz.get(r.quiz_id);
    return {
      classWorkId: r.id,
      quizId: r.quiz_id,
      dueDate: r.due_date,
      difficulty: r.quizzes?.difficulty ?? "normal",
      lessonTitle: r.quizzes?.lessons?.title ?? "Untitled Lesson",
      subjectName: r.quizzes?.lessons?.subjects?.name ?? null,
      attemptStatus: attempt ? (attempt.status as AttemptStatus) : "not_started",
      score: attempt?.score ?? null,
    };
  });
}
