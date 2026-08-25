import { useEffect, useMemo, useState } from "react";
import { User, ChevronRight } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchLinkedChildren, getSignedChildPhotoUrl, type LinkedChild } from "../features/parent/api";
import { fetchStudentAssignments } from "../features/assignments/api";
import { fetchQuizHistory } from "../features/quiz/api";

interface ChildSummary {
  child: LinkedChild;
  photoUrl: string | null;
  pendingCount: number;
  averageScore: number | null;
}

export default function ParentHome() {
  const { profile } = useAuth();
  const [summaries, setSummaries] = useState<ChildSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const children = await fetchLinkedChildren(profile.id);
        const results = await Promise.all(
          children.map(async (child) => {
            const [photoUrl, assignments, quizHistory] = await Promise.all([
              child.photo_url ? getSignedChildPhotoUrl(child.photo_url) : Promise.resolve(null),
              child.class_id ? fetchStudentAssignments(child.id, child.class_id) : Promise.resolve([]),
              fetchQuizHistory(child.id),
            ]);
            const pendingCount = assignments.filter((a) => a.attemptStatus !== "submitted").length;
            const averageScore =
              quizHistory.length > 0
                ? Math.round(quizHistory.reduce((sum, h) => sum + h.score, 0) / quizHistory.length)
                : null;
            return { child, photoUrl, pendingCount, averageScore };
          })
        );
        if (!cancelled) setSummaries(results);
      } catch (err) {
        console.error("Failed to load children:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const heading = useMemo(() => `Welcome, ${profile?.full_name ?? ""}`, [profile?.full_name]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display text-xl text-abyssal-100">{heading}</h1>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-24 rounded-lg bg-abyssal-900" />
          <div className="h-24 rounded-lg bg-abyssal-900" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="bg-abyssal-900 rounded-lg p-6 text-center">
          <User className="mx-auto text-abyssal-300 mb-2" size={24} />
          <p className="font-body text-sm text-abyssal-300">
            No children linked to your account yet. Contact your school admin.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map(({ child, photoUrl, pendingCount, averageScore }) => (
            <div key={child.id} className="bg-abyssal-900 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-abyssal-800 flex items-center justify-center overflow-hidden shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt={child.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={22} className="text-abyssal-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm text-abyssal-100 truncate">{child.full_name}</p>
                  <p className="font-ui text-xs text-abyssal-300 mt-0.5">
                    {child.class_name ?? "Unassigned"} · ID: {child.unique_student_id ?? "—"}
                  </p>
                </div>
                <ChevronRight size={18} className="text-abyssal-500 shrink-0" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-abyssal-800 rounded p-2 text-center">
                  <p className="font-display text-lg text-abyssal-100">{pendingCount}</p>
                  <p className="font-ui text-xs text-abyssal-300">Pending</p>
                </div>
                <div className="bg-abyssal-800 rounded p-2 text-center">
                  <p className="font-display text-lg text-abyssal-100">
                    {averageScore !== null ? `${averageScore}%` : "—"}
                  </p>
                  <p className="font-ui text-xs text-abyssal-300">Avg. score</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
