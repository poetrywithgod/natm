import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchOwnStudentRecord } from "../features/profile/api";
import {
  fetchQuizWithQuestions,
  startOrResumeAttempt,
  fetchExistingAnswers,
  submitQuizAttempt,
  getSignedLessonPdfUrl,
  getStreamThumbnailUrl,
  getStreamPlayerUrl,
  type QuizWithQuestions,
} from "../features/quiz/api";
import { checkAndAwardBadges, type BadgeDefinition } from "../features/gamification/api";
import { getBadgeIcon } from "../features/gamification/icons";

export default function StudentQuiz() {
  const { quizId } = useParams<{ quizId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; newBadges: BadgeDefinition[] } | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);

  useEffect(() => {
    if (!quizId || !profile?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const record = await fetchOwnStudentRecord(profile.id);
        if (!record) throw new Error("Student record not found");
        if (cancelled) return;
        setStudentId(record.id);

        const q = await fetchQuizWithQuestions(quizId);
        if (!q) throw new Error("Quiz not found");
        if (cancelled) return;
        setQuiz(q);

        const attId = await startOrResumeAttempt(quizId, record.id);
        if (cancelled) return;
        setAttemptId(attId);

        const existing = await fetchExistingAnswers(attId);
        if (cancelled) return;
        const prefill: Record<string, string> = {};
        for (const a of existing) {
          if (a.student_answer) prefill[a.question_id] = a.student_answer;
        }
        setAnswers(prefill);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load quiz");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, profile?.id]);

  async function handleSubmit() {
    if (!attemptId || !quiz || !studentId || !profile?.school_id) return;
    const unanswered = quiz.questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0 && !confirm(`${unanswered.length} question(s) left blank. Submit anyway?`)) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const score = await submitQuizAttempt(attemptId, quiz.questions, answers);
      const newBadges = await checkAndAwardBadges(studentId, profile.school_id);
      setResult({ score, newBadges });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleViewLessonPdf() {
    if (!quiz?.lessonPdfStoragePath) return;
    setOpeningPdf(true);
    try {
      const url = await getSignedLessonPdfUrl(quiz.lessonPdfStoragePath);
      if (url) window.open(url, "_blank");
      else setError("Couldn't open that PDF right now.");
    } finally {
      setOpeningPdf(false);
    }
  }

  if (loading) {
    return <div className="p-4 font-ui text-sm text-abyssal-300">Loading quiz...</div>;
  }

  if (error && !quiz) {
    return (
      <div className="p-4 space-y-3">
        <p className="font-ui text-sm text-error">{error}</p>
        <button onClick={() => navigate("/student/assignments")} className="font-ui text-sm text-abyssal-300 underline">
          Back to Assignments
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="p-4 space-y-6 text-center">
        <div className="pt-8">
          <p className="font-ui text-sm text-abyssal-300">You scored</p>
          <p className="font-display text-5xl text-lime mt-1">{result.score}%</p>
        </div>

        {result.newBadges.length > 0 && (
          <div className="space-y-3">
            <p className="font-ui text-sm text-abyssal-100">New badge{result.newBadges.length > 1 ? "s" : ""} earned!</p>
            <div className="flex flex-wrap justify-center gap-3">
              {result.newBadges.map((b) => {
                const Icon = getBadgeIcon(b.icon);
                return (
                  <div key={b.key} className="bg-abyssal-900 rounded-lg p-4 w-32">
                    <Icon className="mx-auto text-lime mb-2" size={28} />
                    <p className="font-ui text-xs text-abyssal-100 font-semibold">{b.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate("/student/assignments")}
          className="w-full max-w-xs mx-auto px-4 py-2 rounded bg-lime text-abyssal-950 font-ui text-sm font-semibold"
        >
          Back to Assignments
        </button>
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/student/assignments")} aria-label="Back">
          <ArrowLeft size={20} className="text-abyssal-100" />
        </button>
        <div>
          <h1 className="font-display text-lg text-abyssal-100">{quiz.lessonTitle}</h1>
          <p className="font-ui text-xs text-abyssal-300">{quiz.subjectName ?? "General"}</p>
        </div>
      </div>

      {quiz.lessonContentType === "video" && quiz.lessonVideoId && (
        <div className="bg-abyssal-900 rounded-lg p-4 space-y-2">
          <p className="font-ui text-sm text-abyssal-100 font-semibold">Lesson video</p>
          {!showVideo ? (
            <button
              onClick={() => setShowVideo(true)}
              className="relative w-full max-w-sm rounded-lg overflow-hidden aspect-video"
            >
              <img
                src={getStreamThumbnailUrl(quiz.lessonVideoId)}
                alt=""
                className="w-full h-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-abyssal-950/40">
                <PlayCircle className="text-abyssal-100" size={40} />
              </span>
            </button>
          ) : (
            <div className="aspect-video w-full max-w-sm rounded-lg overflow-hidden">
              <iframe
                src={getStreamPlayerUrl(quiz.lessonVideoId)}
                className="w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                title={quiz.lessonTitle}
              />
            </div>
          )}
          <p className="font-ui text-xs text-abyssal-300">Watch before answering if you need a refresher.</p>
        </div>
      )}

      {quiz.lessonContentType === "pdf" && quiz.lessonPdfStoragePath && (
        <div className="bg-abyssal-900 rounded-lg p-4 flex items-center justify-between">
          <p className="font-ui text-sm text-abyssal-100 font-semibold">Lesson material</p>
          <button
            onClick={handleViewLessonPdf}
            disabled={openingPdf}
            className="font-ui text-xs text-lime underline disabled:opacity-50"
          >
            {openingPdf ? "Opening..." : "View lesson PDF"}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {quiz.questions.map((q, idx) => (
          <div key={q.id} className="bg-abyssal-900 rounded-lg p-4 space-y-3">
            <p className="font-ui text-sm text-abyssal-100">
              {idx + 1}. {q.question_text}
            </p>

            {q.question_type === "multiple_choice" && q.options ? (
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    className={`w-full text-left px-3 py-2 rounded-md border font-ui text-sm flex items-center gap-2 ${
                      answers[q.id] === opt
                        ? "border-lime bg-lime/10 text-abyssal-100"
                        : "border-abyssal-700 text-abyssal-300"
                    }`}
                  >
                    {answers[q.id] === opt ? (
                      <CheckCircle2 size={16} className="text-lime shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-abyssal-500 shrink-0" />
                    )}
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Your answer"
                className="w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 font-ui text-sm text-abyssal-100"
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="font-ui text-sm text-error flex items-center gap-1">
          <XCircle size={14} /> {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full px-4 py-3 rounded bg-lime text-abyssal-950 font-ui text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Quiz"}
      </button>
    </div>
  );
}
