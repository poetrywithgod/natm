import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchOwnStudentRecord } from "../features/profile/api";
import { fetchQuizHistory, type QuizHistoryEntry } from "../features/quiz/api";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  normal: "Medium",
  hard: "Hard",
};

function scoreColorClass(score: number): string {
  if (score >= 70) return "bg-success/20 text-success";
  if (score >= 40) return "bg-warning/20 text-warning";
  return "bg-error/20 text-error";
}

export default function StudentProgress() {
  const { profile } = useAuth();
  const [history, setHistory] = useState<QuizHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const record = await fetchOwnStudentRecord(profile.id);
        if (!record) return;
        const data = await fetchQuizHistory(record.id);
        if (!cancelled) setHistory(data);
      } catch (err) {
        console.error("Failed to load quiz history:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const average = useMemo(() => {
    if (history.length === 0) return null;
    const total = history.reduce((sum, h) => sum + h.score, 0);
    return Math.round(total / history.length);
  }, [history]);

  return (
    <div className="p-4 space-y-6">
      <h1 className="font-display text-xl text-abyssal-100">My Progress</h1>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-20 rounded-lg bg-abyssal-900" />
          <div className="h-16 rounded-lg bg-abyssal-900" />
          <div className="h-16 rounded-lg bg-abyssal-900" />
        </div>
      ) : history.length === 0 ? (
        <div className="bg-abyssal-900 rounded-lg p-6 text-center">
          <TrendingUp className="mx-auto text-abyssal-300 mb-2" size={24} />
          <p className="font-body text-sm text-abyssal-300">
            No completed quizzes yet. Once you finish an assignment, your scores will show up here.
          </p>
        </div>
      ) : (
        <>
          {average !== null && (
            <div className="bg-abyssal-900 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-ui text-xs text-abyssal-300">Average score</p>
                <p className="font-display text-2xl text-abyssal-100">{average}%</p>
              </div>
              <span className={`font-ui text-xs px-2 py-1 rounded-full ${scoreColorClass(average)}`}>
                {history.length} quiz{history.length === 1 ? "" : "zes"} completed
              </span>
            </div>
          )}

          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.attemptId} className="bg-abyssal-900 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-ui text-sm text-abyssal-100">{h.lessonTitle}</p>
                    <p className="font-ui text-xs text-abyssal-300 mt-0.5">
                      {h.subjectName ?? "General"} · {DIFFICULTY_LABEL[h.difficulty]} ·{" "}
                      {new Date(h.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-ui shrink-0 ${scoreColorClass(h.score)}`}
                  >
                    {h.score}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
