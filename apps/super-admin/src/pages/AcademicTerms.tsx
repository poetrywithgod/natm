import { useEffect, useMemo, useState } from "react";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fetchTermsOverview, type SchoolTermStatus } from "../features/terms/api";
import StatCard from "../components/StatCard";

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? `From ${fmt(start)}` : `Until ${fmt(end!)}`;
}

export default function AcademicTerms() {
  const [rows, setRows] = useState<SchoolTermStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuesOnly, setIssuesOnly] = useState(false);

  useEffect(() => {
    fetchTermsOverview()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load academic terms"))
      .finally(() => setLoading(false));
  }, []);

  const hasIssue = (r: SchoolTermStatus) =>
    !r.session_name || !r.term_label || r.hasDuplicateCurrentSession || r.hasDuplicateCurrentTerm;

  const issueCount = useMemo(() => rows.filter(hasIssue).length, [rows]);
  const visibleRows = issuesOnly ? rows.filter(hasIssue) : rows;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100">Academic Terms</h1>
        <p className="font-body text-sm text-slate-400 mt-1">
          Which schools have a current session and term set — School Admins manage the actual dates in the staff app.
        </p>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Schools" value={rows.length} icon={CalendarClock} />
            <StatCard label="Needs Attention" value={issueCount} icon={AlertTriangle} />
          </div>

          {issueCount > 0 && (
            <label className="flex items-center gap-2 font-ui text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
              Show only schools needing attention
            </label>
          )}

          {rows.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <CalendarClock className="mx-auto text-slate-600 mb-2" size={28} />
              <p className="font-ui text-sm text-slate-400">No schools yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleRows.map((r) => {
                const issue = hasIssue(r);
                const dateRange = formatDateRange(r.term_start, r.term_end);
                return (
                  <div
                    key={r.school_id}
                    className={`bg-slate-900 border rounded-xl p-4 ${issue ? "border-warning/30" : "border-slate-800"}`}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-display text-slate-100">{r.school_name}</p>
                        <div className="flex items-center gap-3 mt-1 font-ui text-xs text-slate-400">
                          <span>{r.session_name ?? "No current session"}</span>
                          <span>·</span>
                          <span>{r.term_label ?? "No current term"}</span>
                          {dateRange && (
                            <>
                              <span>·</span>
                              <span>{dateRange}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {issue ? (
                        <span className="flex items-center gap-1 font-ui text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                          <AlertTriangle size={12} /> Needs attention
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-ui text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                          <CheckCircle2 size={12} /> OK
                        </span>
                      )}
                    </div>
                    {(r.hasDuplicateCurrentSession || r.hasDuplicateCurrentTerm) && (
                      <p className="font-ui text-xs text-error mt-2">
                        {r.hasDuplicateCurrentSession && "Multiple sessions are flagged current. "}
                        {r.hasDuplicateCurrentTerm && "Multiple terms are flagged current within the current session."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
