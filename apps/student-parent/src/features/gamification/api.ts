import { supabase } from "../../lib/supabase";

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  icon: "footprints" | "flame" | "zap" | "crown" | "star" | "trophy" | "target" | "medal";
}

export interface GamificationStats {
  totalCompleted: number;
  perfectScores: number;
  currentStreak: number;
  longestStreak: number;
}

// Criteria checked against live stats each time badges are (re)checked.
// A badge, once earned, is permanent (see student_badges migration) --
// this list only decides what NEWLY qualifies going forward.
export const BADGE_CATALOG: (BadgeDefinition & { criteria: (s: GamificationStats) => boolean })[] = [
  {
    key: "first_quiz",
    name: "First Steps",
    description: "Complete your first quiz",
    icon: "footprints",
    criteria: (s) => s.totalCompleted >= 1,
  },
  {
    key: "quizzes_5",
    name: "Getting Started",
    description: "Complete 5 quizzes",
    icon: "target",
    criteria: (s) => s.totalCompleted >= 5,
  },
  {
    key: "quizzes_25",
    name: "Quiz Master",
    description: "Complete 25 quizzes",
    icon: "trophy",
    criteria: (s) => s.totalCompleted >= 25,
  },
  {
    key: "streak_3",
    name: "3-Day Streak",
    description: "Complete a quiz 3 days in a row",
    icon: "flame",
    criteria: (s) => s.longestStreak >= 3,
  },
  {
    key: "streak_7",
    name: "Week Warrior",
    description: "Complete a quiz 7 days in a row",
    icon: "zap",
    criteria: (s) => s.longestStreak >= 7,
  },
  {
    key: "streak_30",
    name: "Unstoppable",
    description: "Complete a quiz 30 days in a row",
    icon: "crown",
    criteria: (s) => s.longestStreak >= 30,
  },
  {
    key: "perfect_score",
    name: "Perfectionist",
    description: "Score 100% on a quiz",
    icon: "star",
    criteria: (s) => s.perfectScores >= 1,
  },
  {
    key: "perfect_score_5",
    name: "Perfect Streak",
    description: "Score 100% on 5 quizzes",
    icon: "medal",
    criteria: (s) => s.perfectScores >= 5,
  },
];

// Consecutive-day streak from a list of submission timestamps.
// "Consecutive" = calendar days with at least one submission, allowing
// multiple submissions on the same day, using the student's local
// calendar day (browser timezone) since that's what "counts as today"
// means to the kid using the app.
export function computeStreaks(submittedAtList: string[]): { current: number; longest: number } {
  if (submittedAtList.length === 0) return { current: 0, longest: 0 };

  const dayKeys = new Set(
    submittedAtList.map((iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  const days = Array.from(dayKeys)
    .map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y, m, d).getTime();
    })
    .sort((a, b) => a - b);

  const ONE_DAY = 24 * 60 * 60 * 1000;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] === ONE_DAY) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  // Current streak: walk backward from today (or yesterday, so an
  // in-progress streak doesn't reset to 0 just because the student
  // hasn't done today's quiz yet) as long as consecutive days have activity.
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterdayKey = todayKey - ONE_DAY;
  const daySet = new Set(days);

  let cursor: number | null = null;
  if (daySet.has(todayKey)) cursor = todayKey;
  else if (daySet.has(yesterdayKey)) cursor = yesterdayKey;

  let current = 0;
  while (cursor !== null && daySet.has(cursor)) {
    current += 1;
    cursor -= ONE_DAY;
  }

  return { current, longest };
}

export async function fetchGamificationStats(studentId: string): Promise<GamificationStats> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("score, submitted_at")
    .eq("student_id", studentId)
    .eq("status", "submitted");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const { current, longest } = computeStreaks(rows.map((r) => r.submitted_at as string).filter(Boolean));

  return {
    totalCompleted: rows.length,
    perfectScores: rows.filter((r) => r.score === 100).length,
    currentStreak: current,
    longestStreak: longest,
  };
}

export async function fetchEarnedBadgeKeys(studentId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("student_badges").select("badge_key").eq("student_id", studentId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.badge_key));
}

// Call after a quiz submission (and as a harmless catch-all on Progress
// page load) -- computes live stats, checks every catalog badge the
// student hasn't already earned, and durably awards any newly-qualified
// ones. Returns the badges that were newly awarded THIS call, so the UI
// can show a "you earned a badge!" celebration.
export async function checkAndAwardBadges(
  studentId: string,
  schoolId: string
): Promise<BadgeDefinition[]> {
  const [stats, earned] = await Promise.all([
    fetchGamificationStats(studentId),
    fetchEarnedBadgeKeys(studentId),
  ]);

  const newlyEarned = BADGE_CATALOG.filter((b) => !earned.has(b.key) && b.criteria(stats));
  if (newlyEarned.length === 0) return [];

  const { error } = await supabase.from("student_badges").insert(
    newlyEarned.map((b) => ({ school_id: schoolId, student_id: studentId, badge_key: b.key }))
  );
  // A unique-constraint race (e.g. two tabs open) just means someone else
  // already awarded it -- not a real failure, nothing more to do either way.
  if (error && !error.message.includes("duplicate key")) throw new Error(error.message);

  return newlyEarned;
}
