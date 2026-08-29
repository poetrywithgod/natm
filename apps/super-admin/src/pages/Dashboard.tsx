import { useEffect, useState } from "react";
import { Building2, Users, GraduationCap, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchSchools, type SchoolRow } from "../features/schools/api";
import { fetchGlobalAuditLog, type AuditLogRow } from "../features/audit/api";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-ui text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <Icon size={16} className="text-amber-500" />
        </div>
      </div>
      <p className="font-display text-3xl font-extrabold text-slate-100">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSchools(), fetchGlobalAuditLog(8)])
      .then(([s, a]) => {
        setSchools(s);
        setRecentActivity(a);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const activeSchools = schools.filter((s) => s.is_active).length;
  const totalStudents = schools.reduce((sum, s) => sum + s.student_count, 0);
  const totalStaff = schools.reduce((sum, s) => sum + s.staff_count, 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100">Dashboard</h1>
        <p className="font-body text-sm text-slate-400 mt-1">Platform-wide overview across every school.</p>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Schools" value={schools.length} icon={Building2} />
            <StatCard label="Active Schools" value={activeSchools} icon={Building2} />
            <StatCard label="Total Students" value={totalStudents.toLocaleString()} icon={GraduationCap} />
            <StatCard label="Total Staff" value={totalStaff.toLocaleString()} icon={Users} />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-slate-100">Recent Activity</h2>
              <Link to="/audit-log" className="font-ui text-xs text-amber-400 hover:underline flex items-center gap-1">
                <ScrollText size={14} /> View all
              </Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="font-ui text-xs text-slate-400">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-body text-sm text-slate-100">{r.action}</p>
                      <p className="font-ui text-xs text-slate-400">
                        {r.school_name}
                        {r.actor_name ? ` · ${r.actor_name}` : ""}
                      </p>
                    </div>
                    <span className="font-ui text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
