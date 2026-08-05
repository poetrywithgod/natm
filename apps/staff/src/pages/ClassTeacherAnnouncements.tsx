import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchStaffAnnouncements, type Announcement } from "../features/announcements/api";

export default function ClassTeacherAnnouncements() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    fetchStaffAnnouncements(schoolId)
      .then(setAnnouncements)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load announcements"))
      .finally(() => setLoading(false));
  }, [schoolId]);

  if (loading) return <div className="p-4 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display text-xl text-forest-100">Announcements</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      {announcements.length === 0 && (
        <p className="text-forest-300 font-ui text-sm">No announcements yet.</p>
      )}

      <div className="space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="bg-forest-900 rounded-lg p-4 space-y-1.5">
            <h3 className="font-display text-base text-forest-100">{a.title}</h3>
            <p className="font-ui text-sm text-forest-100 whitespace-pre-wrap">{a.body}</p>
            <p className="font-ui text-[11px] text-forest-300">
              {a.poster?.full_name ?? "Unknown"} · {new Date(a.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
