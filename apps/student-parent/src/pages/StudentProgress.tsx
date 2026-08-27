import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Flame } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchOwnStudentRecord } from "../features/profile/api";
import { fetchQuizHistory, type QuizHistoryEntry } from "../features/quiz/api";
import {
  fetchGamificationStats,
  fetchEarnedBadgeKeys,
  checkAndAwardBadges,
  BADGE_CATALOG,
  type GamificationStats,
} from "../features/gamification/api";
import { getBadgeIcon } from "../features/gamification/icons";

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
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [earnedKeys, setEarnedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id || !profile.school_id) return;
    let cancelled = false;

    (async () => {
      try {
        const record = await fetchOwnStudentRecord(profile.id);
        if (!record) return;
        // Harmless catch-all: covers any badge that should have been
        // awarded but wasn't (e.g. a past submission before this system
        // existed). Real-time awarding happens right after a quiz
        // submission in StudentQuiz.tsx -- this is just a safety net.
        await checkAndAwardBadges(record.id, profile.school_id!);

        const [data, gamificationStats, earned] = await Promise.all([
          fetchQuizHistory(record.id),
          fetchGamificationStats(record.id),
          fetchEarnedBadgeKeys(record.id),
        ]);
        if (!cancelled) {
          setHistory(data);
          setStats(gamificationStats);
          setEarnedKeys(earned);
        }
      } catch (err) {
        console.error("Failed to load quiz history:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.school_id]);

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
          {stats && stats.currentStreak > 0 && (
            <div className="bg-abyssal-900 rounded-lg p-4 flex items-center gap-3">
              <Flame className="text-lime shrink-0" size={28} />
              <div>
                <p className="font-display text-xl text-abyssal-100">{stats.currentStreak}-day streak</p>
                <p className="font-ui text-xs text-abyssal-300">
                  Longest: {stats.longestStreak} day{stats.longestStreak === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h2 className="font-display text-base text-abyssal-100">My Badges</h2>
            <div className="grid grid-cols-3 gap-2">
              {BADGE_CATALOG.map((b) => {
                const earned = earnedKeys.has(b.key);
                const Icon = getBadgeIcon(b.icon);
                return (
                  <div
                    key={b.key}
                    className={`rounded-lg p-3 text-center ${earned ? "bg-abyssal-900" : "bg-abyssal-900/40"}`}
                  >
                    <Icon className={`mx-auto mb-1 ${earned ? "text-lime" : "text-abyssal-700"}`} size={22} />
                    <p className={`font-ui text-[11px] leading-tight ${earned ? "text-abyssal-100" : "text-abyssal-500"}`}>
                      {b.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

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
