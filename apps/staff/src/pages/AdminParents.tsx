import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchParentsGroupedByClass,
  getSignedParentPhotoUrl,
  type ParentClassGroup,
} from "../features/parents/api";

export default function AdminParents() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [groups, setGroups] = useState<ParentClassGroup[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchParentsGroupedByClass(schoolId);
        if (cancelled) return;
        setGroups(data);

        const withPhoto = data.flatMap((g) => g.parents).filter((p) => p.photo_url);
        const urls: Record<string, string> = {};
        await Promise.all(
          withPhoto.map(async (p) => {
            const url = await getSignedParentPhotoUrl(p.photo_url!);
            if (url) urls[p.id] = url;
          })
        );
        if (!cancelled) setPhotoUrls(urls);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load parents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  const totalParents = groups.reduce((sum, g) => sum + g.parents.length, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Parents & Guardians</h1>
      <p className="font-ui text-xs text-forest-300 -mt-4">
        Every linked parent/guardian, grouped by their child's class. A parent with children in more than
        one class appears in each relevant group.
      </p>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      {totalParents === 0 && !error && (
        <p className="text-forest-300 font-ui text-sm">
          No parents linked yet — add one from a student's profile.
        </p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.classId} className="space-y-3">
            <h2 className="font-display text-sm text-forest-300 uppercase tracking-wide">
              {group.className}{" "}
              <span className="font-ui normal-case text-forest-300/70">({group.parents.length})</span>
            </h2>

            {group.parents.map((parent) => (
              <Link
                key={parent.id}
                to={`/admin/parents/${parent.id}`}
                className="bg-forest-900 rounded-lg p-4 flex items-center gap-4 hover:bg-forest-900/70"
              >
                {photoUrls[parent.id] ? (
                  <img
                    src={photoUrls[parent.id]}
                    alt={parent.full_name}
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-forest-700 flex items-center justify-center shrink-0">
                    <User size={20} className="text-forest-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-lg text-forest-100">{parent.full_name}</p>
                  <p className="font-ui text-xs text-forest-300 mt-0.5 truncate">
                    {parent.children
                      .map((c) => (c.relationship ? `${c.relationship} of ${c.student_name}` : c.student_name))
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
