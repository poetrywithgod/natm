import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchAuditLogs, type AuditLogEntry } from "../features/audit/api";
import { AUDIT_CATEGORIES, describeAuditAction } from "@natm/shared-types";

function describeDetails(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  const parts = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default function AdminAuditLog() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    fetchAuditLogs(schoolId)
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const filtered = useMemo(() => {
    const category = AUDIT_CATEGORIES.find((c) => c.label === categoryFilter);
    return logs.filter((l) => {
      if (category && category.label !== "All" && !category.prefixes.some((p) => l.action.startsWith(p))) {
        return false;
      }
      if (search) {
        const haystack = `${l.action} ${l.actor?.full_name ?? ""} ${l.entity_type}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [logs, categoryFilter, search]);

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Audit Log</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
        >
          {AUDIT_CATEGORIES.map((c) => (
            <option key={c.label} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search by name or action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-forest-300 font-ui text-sm">No activity matches this filter.</p>
        )}

        {filtered.map((log) => {
          const detailsText = describeDetails(log.details);
          return (
            <div key={log.id} className="bg-forest-900 rounded-lg p-3">
              <p className="font-ui text-sm text-forest-100">
                <span className="font-semibold">{log.actor?.full_name ?? "Unknown"}</span>{" "}
                {describeAuditAction(log.action)}
              </p>
              {detailsText && <p className="font-ui text-xs text-forest-300 mt-0.5">{detailsText}</p>}
              <p className="font-ui text-[11px] text-forest-300/70 mt-1">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
