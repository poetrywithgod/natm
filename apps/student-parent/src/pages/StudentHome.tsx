import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowRight, Flame } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchOwnStudentRecord, type StudentRecord } from "../features/profile/api";
import { fetchStudentAssignments, type StudentAssignment } from "../features/assignments/api";
import { fetchGamificationStats } from "../features/gamification/api";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  normal: "Medium",
  hard: "Hard",
};

export default function StudentHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchOwnStudentRecord(profile.id).then(async (rec) => {
      if (cancelled) return;
      setRecord(rec);
      if (rec?.class_id) {
        const list = await fetchStudentAssignments(rec.id, rec.class_id);
        if (!cancelled) setAssignments(list);
      }
      if (rec) {
        const stats = await fetchGamificationStats(rec.id);
        if (!cancelled) setStreak(stats.currentStreak);
      }
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const pending = assignments.filter((a) => a.attemptStatus !== "submitted").slice(0, 3);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-abyssal-100">
            Welcome back, {profile?.full_name?.split(" ")[0] ?? "there"}!
          </h1>
          {record && (
            <p className="font-body text-sm text-abyssal-300 mt-1">
              Student ID: {record.unique_student_id}
            </p>
          )}
        </div>
        {streak > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 bg-abyssal-900 rounded-full px-3 py-1.5">
            <Flame size={16} className="text-lime" />
            <span className="font-display text-sm text-abyssal-100">{streak}</span>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base text-abyssal-100">My Assignments</h2>
          <button
            onClick={() => navigate("/student/assignments")}
            className="flex items-center gap-1 text-xs text-abyssal-300 hover:text-abyssal-100 font-ui"
          >
            View all <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-16 rounded-lg bg-abyssal-900" />
            <div className="h-16 rounded-lg bg-abyssal-900" />
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-abyssal-900 rounded-lg p-6 text-center">
            <BookOpen className="mx-auto text-abyssal-300 mb-2" size={24} />
            <p className="font-body text-sm text-abyssal-300">
              You're all caught up! No pending assignments right now.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((a) => (
              <button
                key={a.classWorkId}
                onClick={() => navigate("/student/assignments")}
                className="w-full text-left bg-abyssal-900 rounded-lg p-4 flex items-center justify-between hover:bg-abyssal-700 transition-colors"
              >
                <div>
                  <p className="font-ui text-sm text-abyssal-100">{a.lessonTitle}</p>
                  <p className="font-ui text-xs text-abyssal-300 mt-0.5">
                    {a.subjectName ?? "General"} · {DIFFICULTY_LABEL[a.difficulty]}
                    {a.dueDate && ` · Due ${new Date(a.dueDate).toLocaleDateString()}`}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2 py-1 rounded-full font-ui shrink-0 ${
                    a.attemptStatus === "in_progress"
                      ? "bg-lime/20 text-lime"
                      : "bg-abyssal-700 text-abyssal-300"
                  }`}
                >
                  {a.attemptStatus === "in_progress" ? "In Progress" : "Start"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
