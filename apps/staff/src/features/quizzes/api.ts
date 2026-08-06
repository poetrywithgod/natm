import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

export type QuizDifficulty = "easy" | "normal" | "hard";
export type QuizStatus = "generating" | "ready" | "failed";
export type QuestionType = "multiple_choice" | "fill_in_blank";

export interface Quiz {
  id: string;
  lesson_id: string;
  school_id: string;
  difficulty: QuizDifficulty;
  status: QuizStatus;
  error_message: string | null;
  created_by: string;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
  order_index: number;
}

// Kicks off generation via the Edge Function -- the function creates the
// quiz row itself and returns its id once questions are saved (or failed).
export async function generateQuiz(lessonId: string, difficulty: QuizDifficulty): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-quiz", {
    body: { lesson_id: lessonId, difficulty },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const body = await response.json();
        throw new Error(body?.error ?? error.message);
      } catch {
        throw new Error(error.message);
      }
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data.quiz_id as string;
}

export async function fetchQuizzesForLesson(lessonId: string): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchQuiz(quizId: string): Promise<Quiz | null> {
  const { data, error } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateQuizQuestion(
  questionId: string,
  updates: Partial<Pick<QuizQuestion, "question_text" | "options" | "correct_answer" | "marks">>,
  schoolId: string,
  quizId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("quiz_questions").update(updates).eq("id", questionId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "quiz_question.edited",
    entity_type: "quiz",
    entity_id: quizId,
    details: { question_id: questionId },
  });
}

export async function deleteQuizQuestion(
  questionId: string,
  schoolId: string,
  quizId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("quiz_questions").delete().eq("id", questionId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "quiz_question.deleted",
    entity_type: "quiz",
    entity_id: quizId,
    details: { question_id: questionId },
  });
}
