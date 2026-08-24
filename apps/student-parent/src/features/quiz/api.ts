import { supabase } from "../../lib/supabase";

export interface QuizQuestion {
  id: string;
  question_type: "multiple_choice" | "fill_in_blank";
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
  order_index: number;
}

export interface QuizWithQuestions {
  id: string;
  difficulty: "easy" | "normal" | "hard";
  lessonTitle: string;
  subjectName: string | null;
  questions: QuizQuestion[];
}

export interface ExistingAnswer {
  question_id: string;
  student_answer: string | null;
}

export async function fetchQuizWithQuestions(quizId: string): Promise<QuizWithQuestions | null> {
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, difficulty, lessons(title, subjects(name))")
    .eq("id", quizId)
    .single();
  if (quizError || !quiz) return null;

  const { data: questions, error: qError } = await supabase
    .from("quiz_questions")
    .select("id, question_type, question_text, options, correct_answer, marks, order_index")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true });
  if (qError) throw new Error(qError.message);

  const lessons = quiz.lessons as unknown as { title: string; subjects: { name: string } | null } | null;

  return {
    id: quiz.id,
    difficulty: quiz.difficulty,
    lessonTitle: lessons?.title ?? "Untitled Lesson",
    subjectName: lessons?.subjects?.name ?? null,
    questions: (questions ?? []) as QuizQuestion[],
  };
}

export interface QuizHistoryEntry {
  attemptId: string;
  quizId: string;
  lessonTitle: string;
  subjectName: string | null;
  difficulty: "easy" | "normal" | "hard";
  score: number;
  submittedAt: string;
}

export async function fetchQuizHistory(studentId: string): Promise<QuizHistoryEntry[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(
      "id, quiz_id, score, submitted_at, quizzes(difficulty, lessons(title, subjects(name)))"
    )
    .eq("student_id", studentId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const quiz = row.quizzes as unknown as {
      difficulty: "easy" | "normal" | "hard";
      lessons: { title: string; subjects: { name: string } | null } | null;
    } | null;
    return {
      attemptId: row.id,
      quizId: row.quiz_id,
      lessonTitle: quiz?.lessons?.title ?? "Untitled Lesson",
      subjectName: quiz?.lessons?.subjects?.name ?? null,
      difficulty: quiz?.difficulty ?? "normal",
      score: row.score ?? 0,
      submittedAt: row.submitted_at as string,
    };
  });
}

export async function startOrResumeAttempt(quizId: string, studentId: string): Promise<string> {
  const { data: existing, error: fetchError } = await supabase
    .from("quiz_attempts")
    .select("id, status")
    .eq("quiz_id", quizId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("quiz_attempts")
    .insert({ quiz_id: quizId, student_id: studentId, status: "in_progress" })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  return created.id;
}

export async function fetchExistingAnswers(attemptId: string): Promise<ExistingAnswer[]> {
  const { data, error } = await supabase
    .from("quiz_answers")
    .select("question_id, student_answer")
    .eq("attempt_id", attemptId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function isCorrect(studentAnswer: string, correctAnswer: string): boolean {
  return studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

export async function submitQuizAttempt(
  attemptId: string,
  questions: QuizQuestion[],
  answers: Record<string, string>
): Promise<number> {
  let totalMarks = 0;
  let earnedMarks = 0;

  const rows = questions.map((q) => {
    const studentAnswer = answers[q.id] ?? "";
    const correct = studentAnswer.trim().length > 0 && isCorrect(studentAnswer, q.correct_answer);
    totalMarks += q.marks;
    if (correct) earnedMarks += q.marks;
    return {
      attempt_id: attemptId,
      question_id: q.id,
      student_answer: studentAnswer || null,
      is_correct: correct,
      marks_awarded: correct ? q.marks : 0,
    };
  });

  const { error: answersError } = await supabase
    .from("quiz_answers")
    .upsert(rows, { onConflict: "attempt_id,question_id" });
  if (answersError) throw new Error(answersError.message);

  const score = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;

  const { error: attemptError } = await supabase
    .from("quiz_attempts")
    .update({ status: "submitted", score, submitted_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (attemptError) throw new Error(attemptError.message);

  return score;
}
