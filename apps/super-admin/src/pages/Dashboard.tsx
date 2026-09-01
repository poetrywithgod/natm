import { useEffect, useMemo, useState } from "react";
import { Building2, Users, GraduationCap, ScrollText, AlertCircle, Wallet, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchSchools, type SchoolRow } from "../features/schools/api";
import { fetchGlobalAuditLog, type AuditLogRow } from "../features/audit/api";
import { fetchAllCurrentInvoiceStatuses, fetchRevenueSummary, type SubscriptionStatusRow, type RevenueSummary } from "../features/subscriptions/api";
import { fetchAllStaff, STAFF_ROLES, ROLE_LABELS, type StaffRow } from "../features/staff/api";

// "Control room" palette pulled straight from index.css's @theme block --
// kept here rather than reading CSS vars at runtime since Recharts wants
// literal color strings, not var(--...) references, for fills/strokes.
const COLORS = {
  grid: "#1B2130",
  axis: "#64748B",
  bar: "#D9A441",
  paid: "#22C55E",
  outstanding: "#EF4444",
  tooltipBg: "#131722",
  tooltipBorder: "#2A3244",
  pie: ["#D9A441", "#22C55E", "#A9B4C4", "#EF4444", "#F0CB82"],
};

const TOOLTIP_STYLE = {
  background: COLORS.tooltipBg,
  border: `1px solid ${COLORS.tooltipBorder}`,
  fontSize: 12,
  fontFamily: "IBM Plex Sans, sans-serif",
};

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
      <p className="font-display text-2xl lg:text-3xl font-extrabold text-slate-100 truncate">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="font-display font-bold text-slate-100 mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [allActivity, setAllActivity] = useState<AuditLogRow[]>([]);
  const [invoiceStatuses, setInvoiceStatuses] = useState<SubscriptionStatusRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueSummary>({ thisTerm: 0, thisYear: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 500 rows is plenty of headroom for the 14-day activity trend below
    // without needing a dedicated aggregation function -- same
    // lightweight-client-side-grouping approach as fetchSchools.
    Promise.all([
      fetchSchools(),
      fetchAllStaff(),
      fetchGlobalAuditLog(500),
      fetchAllCurrentInvoiceStatuses(),
      fetchRevenueSummary(),
    ])
      .then(([s, st, activity, invoices, rev]) => {
        setSchools(s);
        setStaff(st);
        setAllActivity(activity);
        setInvoiceStatuses(invoices);
        setRevenue(rev);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const activeSchools = schools.filter((s) => s.is_active).length;
  const totalStudents = schools.reduce((sum, s) => sum + s.student_count, 0);
  const totalStaff = schools.reduce((sum, s) => sum + s.staff_count, 0);
  const overdueCount = invoiceStatuses.filter((inv) => inv.amount_due - inv.amount_paid > 0.01).length;
  const recentActivity = allActivity.slice(0, 8);

  const studentsBySchool = useMemo(
    () =>
      [...schools]
        .sort((a, b) => b.student_count - a.student_count)
        .map((s) => ({ name: s.name, students: s.student_count })),
    [schools]
  );

  const staffByRole = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of staff) {
      if (!s.is_active) continue;
      counts.set(s.role, (counts.get(s.role) ?? 0) + 1);
    }
    return STAFF_ROLES.map((r) => ({ name: ROLE_LABELS[r], value: counts.get(r) ?? 0 })).filter((d) => d.value > 0);
  }, [staff]);

  const financialModelSplit = useMemo(() => {
    const fees = schools.filter((s) => s.financial_model === "fees").length;
    const partnership = schools.filter((s) => s.financial_model === "partnership").length;
    return [
      { name: "Fees", value: fees },
      { name: "Partnership", value: partnership },
    ].filter((d) => d.value > 0);
  }, [schools]);

  const paymentsBySchool = useMemo(() => {
    const bySchool = new Map<string, { paid: number; outstanding: number }>();
    for (const inv of invoiceStatuses) {
      const cur = bySchool.get(inv.school_id) ?? { paid: 0, outstanding: 0 };
      cur.paid += inv.amount_paid;
      cur.outstanding += Math.max(0, inv.amount_due - inv.amount_paid);
      bySchool.set(inv.school_id, cur);
    }
    const nameById = new Map(schools.map((s) => [s.id, s.name]));
    return [...bySchool.entries()]
      .map(([schoolId, v]) => ({ name: nameById.get(schoolId) ?? "Unknown", ...v }))
      .filter((d) => d.paid > 0 || d.outstanding > 0);
  }, [invoiceStatuses, schools]);

  const activityTrend = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: 0 });
    }
    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const a of allActivity) {
      const bucket = byDate.get(a.created_at.slice(0, 10));
      if (bucket) bucket.count += 1;
    }
    return days;
  }, [allActivity]);

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Schools" value={schools.length} icon={Building2} />
            <StatCard label="Active Schools" value={activeSchools} icon={Building2} />
            <StatCard label="Total Students" value={totalStudents.toLocaleString()} icon={GraduationCap} />
            <StatCard label="Total Staff" value={totalStaff.toLocaleString()} icon={Users} />
            <StatCard label="Revenue This Term" value={`₦${revenue.thisTerm.toLocaleString()}`} icon={Wallet} />
            <StatCard label="Revenue This Year" value={`₦${revenue.thisYear.toLocaleString()}`} icon={TrendingUp} />
          </div>

          {overdueCount > 0 && (
            <Link
              to="/schools"
              className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-2xl p-4 hover:bg-warning/15 transition-colors"
            >
              <AlertCircle size={18} className="text-warning" />
              <p className="font-body text-sm text-slate-100">
                {overdueCount} school{overdueCount === 1 ? " has" : "s have"} an outstanding subscription invoice —
                review under each school's page.
              </p>
            </Link>
          )}

          {schools.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <Building2 className="mx-auto text-slate-600 mb-2" size={28} />
              <p className="font-ui text-sm text-slate-400">
                Charts will appear here once there's at least one school on the platform.
              </p>
            </div>
          ) : (
            <>
              <ChartCard title="Platform Activity — last 14 days">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={activityTrend}>
                    <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: COLORS.axis, fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: COLORS.axis, fontSize: 11 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#E8EAF0" }} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Actions logged"
                      stroke={COLORS.bar}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COLORS.bar }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="grid lg:grid-cols-2 gap-4">
                <ChartCard title="Students by School">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={studentsBySchool} margin={{ bottom: 24 }}>
                      <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: COLORS.axis, fontSize: 11 }}
                        angle={-20}
                        textAnchor="end"
                        interval={0}
                        height={50}
                      />
                      <YAxis allowDecimals={false} tick={{ fill: COLORS.axis, fontSize: 11 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#E8EAF0" }} />
                      <Bar dataKey="students" fill={COLORS.bar} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Staff by Role">
                  {staffByRole.length === 0 ? (
                    <p className="font-ui text-xs text-slate-400">No active staff yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={staffByRole} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                          {staffByRole.map((_, i) => (
                            <Cell key={i} fill={COLORS.pie[i % COLORS.pie.length]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif" }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#E8EAF0" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard title="Schools by Financial Model">
                  {financialModelSplit.length === 0 ? (
                    <p className="font-ui text-xs text-slate-400">No schools yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={financialModelSplit}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {financialModelSplit.map((_, i) => (
                            <Cell key={i} fill={COLORS.pie[i % COLORS.pie.length]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif" }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#E8EAF0" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard title="Subscription Payments by School">
                  {paymentsBySchool.length === 0 ? (
                    <p className="font-ui text-xs text-slate-400">No invoices yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={paymentsBySchool} margin={{ bottom: 24 }}>
                        <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: COLORS.axis, fontSize: 11 }}
                          angle={-20}
                          textAnchor="end"
                          interval={0}
                          height={50}
                        />
                        <YAxis tick={{ fill: COLORS.axis, fontSize: 11 }} tickFormatter={(v) => `₦${v.toLocaleString()}`} />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          labelStyle={{ color: "#E8EAF0" }}
                          formatter={(v) => `₦${Number(v).toLocaleString()}`}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans, sans-serif" }} />
                        <Bar dataKey="paid" name="Paid" stackId="pay" fill={COLORS.paid} radius={[0, 0, 0, 0]} />
                        <Bar
                          dataKey="outstanding"
                          name="Outstanding"
                          stackId="pay"
                          fill={COLORS.outstanding}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>
            </>
          )}

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
