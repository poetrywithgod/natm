import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { User } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchParentProfile,
  getSignedParentPhotoUrl,
  type ParentProfile,
} from "../features/parents/api";
import CollapsibleSection from "../components/CollapsibleSection";

export default function AdminParentProfile() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [parent, setParent] = useState<ParentProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !schoolId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchParentProfile(id, schoolId);
        if (cancelled) return;
        setParent(data);
        if (data?.photo_url) {
          const url = await getSignedParentPhotoUrl(data.photo_url);
          if (!cancelled) setPhotoUrl(url);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load parent profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, schoolId]);

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  if (!parent) {
    return (
      <div className="p-6 space-y-4">
        <Link
          to="/admin/parents"
          className="inline-block px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs hover:bg-forest-700/70"
        >
          ← Back to Parents & Guardians
        </Link>
        <p className="text-error font-ui text-sm">{error ?? "Parent not found."}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Link
        to="/admin/parents"
        className="inline-block px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs hover:bg-forest-700/70"
      >
        ← Back to Parents & Guardians
      </Link>

      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt={parent.full_name} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-forest-700 flex items-center justify-center">
            <User size={28} className="text-forest-300" />
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl text-forest-100">{parent.full_name}</h1>
          <p className="font-ui text-xs text-forest-300">
            {parent.children.length} linked {parent.children.length === 1 ? "child" : "children"}
          </p>
        </div>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <CollapsibleSection title="Contact Details" defaultOpen>
        {!parent.phone && !parent.address ? (
          <p className="font-ui text-xs text-forest-300">
            No contact details on file yet — set by the parent from their own Settings.
          </p>
        ) : (
          <>
            {parent.phone && (
              <div>
                <p className="font-ui text-xs text-forest-300">Phone</p>
                <p className="font-ui text-sm text-forest-100">{parent.phone}</p>
              </div>
            )}
            {parent.address && (
              <div>
                <p className="font-ui text-xs text-forest-300">Address</p>
                <p className="font-ui text-sm text-forest-100">{parent.address}</p>
              </div>
            )}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Linked Children" defaultOpen>
        {parent.children.length === 0 ? (
          <p className="font-ui text-xs text-forest-300">No children linked.</p>
        ) : (
          <ul className="space-y-2">
            {parent.children.map((child) => (
              <li key={child.student_id} className="flex items-center justify-between gap-2">
                <div>
                  <Link
                    to={`/admin/students/${child.student_id}`}
                    className="font-ui text-sm text-forest-100 hover:underline"
                  >
                    {child.student_name}
                  </Link>
                  <p className="font-ui text-xs text-forest-300">
                    {child.class_name ?? "No Class (Pending Assessment)"}
                    {child.relationship && ` · ${child.relationship}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>
    </div>
  );
}
