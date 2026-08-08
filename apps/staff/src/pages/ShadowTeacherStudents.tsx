import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchMyStudents, type MyStudent } from "../features/shadowteacher/api";
import { getSignedPhotoUrl } from "../features/students/api";

export default function ShadowTeacherStudents() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<MyStudent[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMyStudents(profile.id)
      .then(async (list) => {
        if (cancelled) return;
        setStudents(list);

        const entries = await Promise.all(
          list
            .filter((s) => s.photo_url)
            .map(async (s) => {
              const url = await getSignedPhotoUrl(s.photo_url as string);
              return [s.id, url] as const;
            })
        );
        if (!cancelled) {
          const map: Record<string, string> = {};
          for (const [id, url] of entries) {
            if (url) map[id] = url;
          }
          setPhotoUrls(map);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load students"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (loading) return <div className="p-4 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display text-xl text-forest-100">My Students</h1>
      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {students.length === 0 && (
        <p className="text-forest-300 font-ui text-sm">No students assigned yet.</p>
      )}
      <div className="space-y-2">
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/shadow-teacher/students/${s.id}`)}
            className="w-full flex items-center gap-3 bg-forest-900 rounded-lg p-3 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-forest-800 overflow-hidden flex items-center justify-center shrink-0 text-forest-300 font-ui text-xs">
              {photoUrls[s.id] ? (
                <img src={photoUrls[s.id]} alt="" className="w-full h-full object-cover" />
              ) : (
                s.full_name.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-ui text-sm text-forest-100 truncate">{s.full_name}</p>
              <p className="font-ui text-xs text-forest-300">{s.class_name ?? "No class"}</p>
            </div>
            <ChevronRight size={18} className="text-forest-400 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
