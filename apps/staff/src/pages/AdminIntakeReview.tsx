import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { fetchEpisodeDetail, approveForm1, type EpisodeDetail } from "../features/assessments/api";

function prettyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-forest-300 italic">—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-forest-300 italic">—</span>;
    return <span className="text-forest-100">{value.map(String).join(", ")}</span>;
  }
  if (typeof value === "object") {
    return (
      <div className="pl-3 border-l border-forest-700 space-y-1 mt-1">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <span className="text-forest-300 font-ui text-xs">{prettyLabel(k)}: </span>
            <JsonValue value={v} />
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-forest-100">{String(value)}</span>;
}

function JsonSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  return (
    <div className="bg-forest-900 rounded-lg p-4 space-y-3">
      <h2 className="font-display text-lg text-forest-100">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-forest-300 font-ui text-sm">No data recorded.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key}>
              <p className="font-ui text-sm text-forest-100 font-semibold">{prettyLabel(key)}</p>
              <JsonValue value={value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminIntakeReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const d = await fetchEpisodeDetail(id);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load submission");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleApprove() {
    if (!detail || !profile?.id) return;
    setApproving(true);
    setError(null);
    try {
      await approveForm1(detail.episodeId, profile.id);
      navigate("/admin/intake");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve submission");
    } finally {
      setApproving(false);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;
  if (!detail) return <div className="p-6 font-ui text-forest-100">Submission not found.</div>;

  const canApprove = detail.status === "form1_submitted";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-forest-100">{detail.studentName}</h1>
          <p className="font-ui text-xs text-forest-300 mt-0.5">
            ID: {detail.uniqueStudentId} — Episode {detail.episodeNumber} — Status: {detail.status}
          </p>
        </div>
        {canApprove ? (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold disabled:opacity-50"
          >
            {approving ? "Approving..." : "Approve Form 1"}
          </button>
        ) : (
          <span className="px-3 py-1.5 rounded bg-forest-700 text-forest-300 font-ui text-xs">
            {detail.status === "form1_approved" ? "Already approved" : detail.status}
          </span>
        )}
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <JsonSection title="Part A — Intake & Consent" data={detail.partA} />
      <JsonSection title="Part B — Functional Domains" data={detail.partB} />
      <JsonSection title="Consents" data={detail.consents} />
    </div>
  );
}
