import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchCurriculumForShadowTeacher, type CurriculumDocView } from "../features/curriculum/api";
import CurriculumList from "../components/CurriculumList";

export default function ShadowTeacherCurriculum() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<CurriculumDocView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id || !profile.school_id) return;
    fetchCurriculumForShadowTeacher(profile.id, profile.school_id)
      .then(setDocs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load curriculum"))
      .finally(() => setLoading(false));
  }, [profile?.id, profile?.school_id]);

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Curriculum</h1>
        <p className="font-ui text-xs text-forest-300 mt-1">
          This term's subjects across your assigned students' classes. Updates automatically when the term
          changes.
        </p>
      </div>
      {error && <p className="font-ui text-sm text-error">{error}</p>}
      {loading ? (
        <p className="font-ui text-sm text-forest-300">Loading...</p>
      ) : (
        <CurriculumList docs={docs} mode="current-term" />
      )}
    </div>
  );
}
