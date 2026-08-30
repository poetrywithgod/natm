import { useEffect, useState } from "react";
import { FileText, ExternalLink, Download } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchCurriculumForStudent, CLASS_LEVEL_LABELS, type CurriculumDocView } from "../features/curriculum/api";

export default function StudentCurriculum() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<CurriculumDocView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id || !profile.school_id) return;
    fetchCurriculumForStudent(profile.id, profile.school_id)
      .then(setDocs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load curriculum"))
      .finally(() => setLoading(false));
  }, [profile?.id, profile?.school_id]);

  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h1 className="font-display text-xl text-abyssal-100">Curriculum</h1>
        <p className="font-body text-xs text-abyssal-300 mt-1">
          This term's subjects for your class.
        </p>
      </div>

      {error && <p className="font-body text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-body text-sm text-abyssal-300">Loading...</p>
      ) : docs.length === 0 ? (
        <div className="bg-abyssal-900 rounded-lg p-8 text-center">
          <FileText className="mx-auto text-abyssal-600 mb-2" size={28} />
          <p className="font-body text-sm text-abyssal-300">No curriculum documents available yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between bg-abyssal-900 rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-body text-sm text-abyssal-100 truncate">{d.subject_name}</p>
                <p className="font-ui text-xs text-abyssal-400 truncate">
                  {CLASS_LEVEL_LABELS[d.level] ?? d.level} · Term {d.term_number}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <a
                  href={d.pdf_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-abyssal-300"
                  aria-label="View PDF"
                >
                  <ExternalLink size={16} />
                </a>
                <a
                  href={d.pdf_url ?? "#"}
                  download={d.pdf_filename ?? undefined}
                  className="text-abyssal-300"
                  aria-label="Download PDF"
                >
                  <Download size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
