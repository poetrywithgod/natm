import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

export interface AssignableQuiz {
  quiz_id: string;
  lesson_title: string;
  subject_name: string;
  difficulty: string;
  question_count: number;
}

export interface ClassWorkItem {
  id: string;
  quiz_id: string;
  due_date: string | null;
  created_at: string;
  lesson_title: string;
  subject_name: string;
  assignee_count: number; // 0 means "whole class"
}

// Quizzes that are ready to assign -- status 'ready', for lessons
// belonging to this class.
export async function fetchAssignableQuizzes(classId: string): Promise<AssignableQuiz[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, difficulty, lesson:lessons!inner(title, class_id, subject:subjects(name)), quiz_questions(count)")
    .eq("status", "ready")
    .eq("lesson.class_id", classId);
  if (error) throw new Error(error.message);
  return (data as any[]).map((q) => ({
    quiz_id: q.id,
    lesson_title: q.lesson?.title ?? "Untitled lesson",
    subject_name: q.lesson?.subject?.name ?? "Unknown subject",
    difficulty: q.difficulty,
    question_count: q.quiz_questions?.[0]?.count ?? 0,
  }));
}

export async function fetchClassWork(classId: string): Promise<ClassWorkItem[]> {
  const { data, error } = await supabase
    .from("class_work")
    .select(
      "id, quiz_id, due_date, created_at, quiz:quizzes(lesson:lessons(title, subject:subjects(name))), class_work_assignees(count)"
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as any[]).map((w) => ({
    id: w.id,
    quiz_id: w.quiz_id,
    due_date: w.due_date,
    created_at: w.created_at,
    lesson_title: w.quiz?.lesson?.title ?? "Untitled lesson",
    subject_name: w.quiz?.lesson?.subject?.name ?? "Unknown subject",
    assignee_count: w.class_work_assignees?.[0]?.count ?? 0,
  }));
}

// studentIds: null/empty means "whole class". Notifies each affected
// student's active Shadow Teacher (if they have one) -- writes a
// notifications row now; actual push delivery is a later build step.
export async function createClassWork(
  schoolId: string,
  classId: string,
  quizId: string,
  dueDate: string | null,
  studentIds: string[] | null,
  actorId: string
): Promise<void> {
  const { data: work, error: workError } = await supabase
    .from("class_work")
    .insert({ school_id: schoolId, class_id: classId, quiz_id: quizId, due_date: dueDate, assigned_by: actorId })
    .select()
    .single();
  if (workError) throw new Error(workError.message);

  const targetStudentIds = studentIds && studentIds.length > 0 ? studentIds : null;

  if (targetStudentIds) {
    const rows = targetStudentIds.map((studentId) => ({ class_work_id: work.id, student_id: studentId }));
    const { error: assigneesError } = await supabase.from("class_work_assignees").insert(rows);
    if (assigneesError) throw new Error(assigneesError.message);
  }

  // Resolve which students are actually affected, to find their Shadow Teachers.
  let affectedStudentIds = targetStudentIds;
  if (!affectedStudentIds) {
    const { data: classStudents, error: studentsError } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", classId);
    if (studentsError) throw new Error(studentsError.message);
    affectedStudentIds = (classStudents as any[]).map((s) => s.id);
  }

  if (affectedStudentIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from("shadow_teacher_assignments")
      .select("student_id, shadow_teacher_id, student:students(full_name)")
      .eq("is_active", true)
      .in("student_id", affectedStudentIds);
    if (assignmentsError) throw new Error(assignmentsError.message);

    if ((assignments as any[]).length > 0) {
      const { data: lessonInfo } = await supabase
        .from("quizzes")
        .select("lesson:lessons(title)")
        .eq("id", quizId)
        .single();
      const lessonTitle = (lessonInfo as any)?.lesson?.title ?? "a lesson";

      const notificationRows = (assignments as any[]).map((a) => ({
        school_id: schoolId,
        recipient_id: a.shadow_teacher_id,
        type: "work_assigned",
        title: "New work assigned",
        body: `${a.student?.full_name ?? "Your student"} was assigned work on "${lessonTitle}".`,
        related_entity_type: "class_work",
        related_entity_id: work.id,
      }));
      const { error: notifyError } = await supabase.from("notifications").insert(notificationRows);
      if (notifyError) throw new Error(notifyError.message);

      // Fire-and-forget push delivery. Notification rows already exist,
      // so a failure here just means delivery waits for a later trigger.
      supabase.functions.invoke("send-push", { body: {} }).catch((err) => {
        console.error("send-push invoke failed:", err);
      });
    }
  }

  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class_work.assigned",
    entity_type: "class",
    entity_id: classId,
    details: { quiz_id: quizId, due_date: dueDate, student_count: targetStudentIds?.length ?? "whole class" },
  });
}
