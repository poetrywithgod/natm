import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchOwnStudentRecord } from "../features/profile/api";
import { fetchStudentAssignments, type StudentAssignment } from "../features/assignments/api";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  normal: "Medium",
  hard: "Hard",
};

type Tab = "today" | "ongoing" | "completed";

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export default function StudentAssignments() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("today");

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchOwnStudentRecord(profile.id).then(async (rec) => {
      if (cancelled || !rec?.class_id) {
        if (!cancelled) setLoading(false);
        return;
      }
      const list = await fetchStudentAssignments(rec.id, rec.class_id);
      if (!cancelled) {
        setAssignments(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const filtered = useMemo(() => {
    if (tab === "completed") return assignments.filter((a) => a.attemptStatus === "submitted");
    if (tab === "today")
      return assignments.filter((a) => a.attemptStatus !== "submitted" && isToday(a.dueDate));
    return assignments.filter((a) => a.attemptStatus !== "submitted" && !isToday(a.dueDate));
  }, [assignments, tab]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "ongoing", label: "Ongoing" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display text-xl text-abyssal-100">My Assignments</h1>

      <div className="flex gap-2 bg-abyssal-900 rounded-lg p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 rounded-md font-ui text-sm transition-colors ${
              tab === t.key ? "bg-lime text-abyssal-950 font-semibold" : "text-abyssal-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-20 rounded-lg bg-abyssal-900" />
          <div className="h-20 rounded-lg bg-abyssal-900" />
          <div className="h-20 rounded-lg bg-abyssal-900" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-abyssal-900 rounded-lg p-8 text-center">
          <p className="font-body text-sm text-abyssal-300">
            {tab === "completed" ? "No completed assignments yet." : "Nothing here right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <button
              key={a.classWorkId}
              onClick={() => navigate(`/student/quiz/${a.quizId}`)}
              disabled={a.attemptStatus === "submitted"}
              className="w-full text-left bg-abyssal-900 rounded-lg p-4 flex items-center justify-between hover:bg-abyssal-700 transition-colors disabled:hover:bg-abyssal-900"
            >
              <div>
                <p className="font-ui text-sm text-abyssal-100">{a.lessonTitle}</p>
                <p className="font-ui text-xs text-abyssal-300 mt-0.5">
                  {a.subjectName ?? "General"} · {DIFFICULTY_LABEL[a.difficulty]}
                  {a.dueDate && ` · Due ${new Date(a.dueDate).toLocaleDateString()}`}
                  {a.score != null && ` · Score: ${a.score}%`}
                </p>
              </div>
              {a.attemptStatus === "submitted" ? (
                <CheckCircle2 className="text-lime shrink-0" size={20} />
              ) : (
                <PlayCircle className="text-abyssal-300 shrink-0" size={20} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
