import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { fetchGlobalAuditLog, type AuditLogRow } from "../features/audit/api";
import { fetchSchools, type SchoolRow } from "../features/schools/api";

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolFilter, setSchoolFilter] = useState("");
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

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-100">Audit Log</h1>
          <p className="font-body text-sm text-slate-400 mt-1">Activity across every school on the platform.</p>
        </div>
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

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : logs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <ScrollText className="mx-auto text-slate-600 mb-2" size={28} />
          <p className="font-ui text-sm text-slate-400">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
          {logs.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-sm text-slate-100">{r.action}</p>
                <p className="font-ui text-xs text-slate-400 truncate">
                  {r.school_name}
                  {r.actor_name ? ` · ${r.actor_name}` : ""} · {r.entity_type}
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
