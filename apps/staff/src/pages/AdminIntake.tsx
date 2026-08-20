import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { fetchIntakeQueue, type IntakeQueueItem } from "../features/assessments/api";

export default function AdminIntake() {
  const { profile } = useAuth();
  const [queue, setQueue] = useState<IntakeQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;

    (async () => {
      try {
        const items = await fetchIntakeQueue(schoolId);
        if (!cancelled) setQueue(items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load intake queue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Intake Review</h1>
        <p className="font-ui text-sm text-forest-300 mt-1">
          Form 1 submissions awaiting review and approval.
        </p>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="space-y-3">
        {queue.length === 0 && (
          <p className="text-forest-300 font-ui text-sm">No submissions waiting on review.</p>
        )}

        {queue.map((item) => (
          <Link
            key={item.episodeId}
            to={`/admin/intake/${item.episodeId}`}
            className="bg-forest-900 rounded-lg p-4 flex items-center justify-between hover:bg-forest-700 transition-colors"
          >
            <div>
              <p className="font-display text-lg text-forest-100">{item.studentName}</p>
              <p className="font-ui text-xs text-forest-300 mt-0.5">
                ID: {item.uniqueStudentId} — Episode {item.episodeNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="font-ui text-xs text-forest-300">
                Submitted {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : "—"}
              </p>
              <span className="font-ui text-xs text-forest-500 font-semibold">Review →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
