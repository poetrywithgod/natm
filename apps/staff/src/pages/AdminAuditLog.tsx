import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchAuditLogs, type AuditLogEntry } from "../features/audit/api";

const ACTION_LABELS: Record<string, string> = {
  "staff.invited": "invited a staff member",
  "staff.deactivated": "deactivated a staff member",
  "staff.reactivated": "reactivated a staff member",
  "student.created": "added a student",
  "student.renamed": "renamed a student",
  "student.class_assigned": "reassigned a student's class",
  "student.photo_uploaded": "updated a student's photo",
  "student.promoted": "promoted a student",
  "student.repeated": "marked a student to repeat",
  "student.carryover_added": "added a subject carryover",
  "student.carryover_removed": "removed a subject carryover",
  "class.created": "created a class",
  "class.renamed": "renamed a class",
  "class.level_changed": "changed a class's level",
  "class.teacher_assigned": "reassigned a class teacher",
  "attendance.marked": "marked attendance",
  "timetable.period_created": "added a timetable period",
  "timetable.period_updated": "edited a timetable period",
  "timetable.period_deleted": "deleted a timetable period",
  "timetable.entry_saved": "set a timetable slot",
  "timetable.entry_cleared": "cleared a timetable slot",
  "fee_type.created": "created a fee type",
  "fee.payment_recorded": "recorded a fee payment",
};

const CATEGORY_PREFIXES = [
  { label: "All", prefix: "" },
  { label: "Staff", prefix: "staff." },
  { label: "Students", prefix: "student." },
  { label: "Classes", prefix: "class." },
  { label: "Attendance", prefix: "attendance." },
  { label: "Timetable", prefix: "timetable." },
  { label: "Fees", prefix: "fee" },
];

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
  const [categoryFilter, setCategoryFilter] = useState("");
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
    return logs.filter((l) => {
      if (categoryFilter && !l.action.startsWith(categoryFilter)) return false;
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
          {CATEGORY_PREFIXES.map((c) => (
            <option key={c.label} value={c.prefix}>
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
                {ACTION_LABELS[log.action] ?? log.action}
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
