import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchCurriculumForSchoolAdmin, type CurriculumDocView } from "../features/curriculum/api";
import CurriculumList from "../components/CurriculumList";

export default function AdminCurriculum() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<CurriculumDocView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.school_id) return;
    fetchCurriculumForSchoolAdmin(profile.school_id)
      .then(setDocs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load curriculum"))
      .finally(() => setLoading(false));
  }, [profile?.school_id]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Curriculum</h1>
        <p className="font-ui text-xs text-forest-300 mt-1">
          Every term, for every class level your school currently has set up. Uploaded and maintained centrally
          by NATM -- not editable here.
        </p>
      </div>
      {error && <p className="font-ui text-sm text-error">{error}</p>}
      {loading ? (
        <p className="font-ui text-sm text-forest-300">Loading...</p>
      ) : (
        <CurriculumList docs={docs} mode="all-terms" />
      )}
    </div>
  );
}
