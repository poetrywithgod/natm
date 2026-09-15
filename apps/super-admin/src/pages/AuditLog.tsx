import { useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { fetchGlobalAuditLog, type AuditLogRow } from "../features/audit/api";
import { fetchSchools, type SchoolRow } from "../features/schools/api";
import { AUDIT_CATEGORIES, describeAuditAction } from "@natm/shared-types";

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolFilter, setSchoolFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchools()
      .then(setSchools)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchGlobalAuditLog(200, schoolFilter || undefined)
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [schoolFilter]);

  const filtered = useMemo(() => {
    const category = AUDIT_CATEGORIES.find((c) => c.label === categoryFilter);
    if (!category || category.label === "All") return logs;
    return logs.filter((l) => category.prefixes.some((p) => l.action.startsWith(p)));
  }, [logs, categoryFilter]);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-100">Audit Log</h1>
          <p className="font-body text-sm text-slate-400 mt-1">Activity across every school on the platform.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-ui text-sm"
          >
            {AUDIT_CATEGORIES.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-ui text-sm"
          >
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <ScrollText className="mx-auto text-slate-600 mb-2" size={28} />
          <p className="font-ui text-sm text-slate-400">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
          {filtered.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-sm text-slate-100">
                  {r.actor_name ? `${r.actor_name} ` : ""}
                  {describeAuditAction(r.action)}
                </p>
                <p className="font-ui text-xs text-slate-400 truncate">
                  {r.school_name} · {r.entity_type}
                </p>
              </div>
              <span className="font-ui text-xs text-slate-500 whitespace-nowrap">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
