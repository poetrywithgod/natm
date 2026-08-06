import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";
import { getCurrentQuarter, finalizeCurrentQuarter } from "../features/grading/api";
import {
  fetchDashboardSummary,
  fetchAttendanceTrend,
  fetchClassDistribution,
  fetchFeeSummary,
  fetchFeeByClass,
  type DashboardSummary,
  type AttendanceDayPoint,
  type ClassDistributionPoint,
  type FeeSummary,
  type ClassFeeStat,
} from "../features/dashboard/api";

const COLORS = {
  present: "#3D8A4E", // forest-500
  absent: "#EF4444", // error
  late: "#F59E0B", // warning
  bar: "#7ED88E", // forest-300
  grid: "#1F4A2C", // forest-700
  paid: "#3D8A4E", // forest-500
  unpaid: "#EF4444", // error
};

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-forest-900 rounded-lg p-4">
      <p className="font-ui text-xs text-forest-300">{label}</p>
      <p className="font-display text-2xl text-forest-100 mt-1">{value}</p>
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export default function SchoolAdminDashboard() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceDayPoint[]>([]);
  const [classDistribution, setClassDistribution] = useState<ClassDistributionPoint[]>([]);
  const [feeSummary, setFeeSummary] = useState<FeeSummary>({ paid: 0, unpaid: 0 });
  const [classFeeStats, setClassFeeStats] = useState<ClassFeeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null);

  const schoolId = profile?.school_id;
  const quarter = getCurrentQuarter();

  async function loadAll() {
    if (!schoolId) return;
    try {
      const [s, a, c, fs, fc] = await Promise.all([
        fetchDashboardSummary(schoolId),
        fetchAttendanceTrend(schoolId),
        fetchClassDistribution(schoolId),
        fetchFeeSummary(schoolId),
        fetchFeeByClass(schoolId),
      ]);
      setSummary(s);
      setAttendanceTrend(a);
      setClassDistribution(c);
      setFeeSummary(fs);
      setClassFeeStats(fc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  // Fee data can change from the Fees page or, later, an automated
  // payment webhook — keep the dashboard live rather than stale.
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`dashboard_fees_${schoolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_fees", filter: `school_id=eq.${schoolId}` },
        () => {
          loadAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function handleFinalizeQuarter() {
    if (!schoolId || !profile) return;
    setFinalizing(true);
    setFinalizeMessage(null);
    setError(null);
    try {
      const count = await finalizeCurrentQuarter(schoolId, profile.id);
      setFinalizeMessage(
        count > 0
          ? `Finalized Q${quarter.quarterNumber} ${quarter.year} scores for ${count} student-subject pair(s).`
          : "No submitted quiz attempts found for this quarter yet."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finalize quarter");
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  const feePieData = [
    { name: "Paid", value: feeSummary.paid },
    { name: "Unpaid", value: feeSummary.unpaid },
  ];
  const hasFeeData = feeSummary.paid + feeSummary.unpaid > 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Dashboard</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Classes" value={summary?.classCount ?? 0} />
        <SummaryCard label="Students" value={summary?.studentCount ?? 0} />
        <SummaryCard label="Staff" value={summary?.staffCount ?? 0} />
        <SummaryCard
          label="Current Session / Term"
          value={
            summary?.currentSessionName
              ? `${summary.currentSessionName}${
                  summary.currentTermNumber ? ` · T${summary.currentTermNumber}` : ""
                }`
              : "Not set"
          }
        />
      </div>

      <div className="bg-forest-900 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-forest-100">
            Finalize Quarter (Q{quarter.quarterNumber} {quarter.year})
          </h2>
          <p className="font-ui text-xs text-forest-300 mt-1">
            Locks in each student's average quiz score per subject for this quarter. Safe to run more
            than once — later attempts get folded in on the next finalize.
          </p>
          {finalizeMessage && <p className="font-ui text-xs text-forest-400 mt-1">{finalizeMessage}</p>}
        </div>
        <button
          onClick={handleFinalizeQuarter}
          disabled={finalizing}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
        >
          {finalizing ? "Finalizing..." : "Finalize Quarter"}
        </button>
      </div>

      <div className="bg-forest-900 rounded-lg p-4">
        <h2 className="font-display text-lg text-forest-100 mb-4">Attendance — Last 7 Days</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={attendanceTrend}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} stroke="#7ED88E" fontSize={12} />
            <YAxis stroke="#7ED88E" fontSize={12} allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => formatDateLabel(v as string)}
              contentStyle={{ background: "#0F2419", border: "1px solid #1F4A2C", fontSize: 12 }}
            />
            <Line type="monotone" dataKey="present" stroke={COLORS.present} strokeWidth={2} />
            <Line type="monotone" dataKey="absent" stroke={COLORS.absent} strokeWidth={2} />
            <Line type="monotone" dataKey="late" stroke={COLORS.late} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
        {attendanceTrend.every((d) => d.present === 0 && d.absent === 0 && d.late === 0) && (
          <p className="font-ui text-xs text-forest-300 mt-2">
            No attendance records yet — this will populate once Attendance is in use.
          </p>
        )}
      </div>

      <div className="bg-forest-900 rounded-lg p-4">
        <h2 className="font-display text-lg text-forest-100 mb-4">Students per Class</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={classDistribution}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="className" stroke="#7ED88E" fontSize={12} />
            <YAxis stroke="#7ED88E" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#0F2419", border: "1px solid #1F4A2C", fontSize: 12 }} />
            <Bar dataKey="studentCount" fill={COLORS.bar} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {classDistribution.length === 0 && (
          <p className="font-ui text-xs text-forest-300 mt-2">No classes yet.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-forest-900 rounded-lg p-4">
          <h2 className="font-display text-lg text-forest-100 mb-4">Fees — Paid vs Unpaid</h2>
          {hasFeeData ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={feePieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  <Cell fill={COLORS.paid} />
                  <Cell fill={COLORS.unpaid} />
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter, sans-serif" }} />
                <Tooltip
                  contentStyle={{ background: "#0F2419", border: "1px solid #1F4A2C", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-ui text-xs text-forest-300">
              No fee data yet for the current term — set one under Sessions & Terms and record fees on
              the Fees page.
            </p>
          )}
        </div>

        <div className="bg-forest-900 rounded-lg p-4">
          <h2 className="font-display text-lg text-forest-100 mb-4">Fees by Class</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={classFeeStats}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="className" stroke="#7ED88E" fontSize={12} />
              <YAxis stroke="#7ED88E" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#0F2419", border: "1px solid #1F4A2C", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter, sans-serif" }} />
              <Bar dataKey="paid" stackId="fees" fill={COLORS.paid} radius={[0, 0, 0, 0]} />
              <Bar dataKey="unpaid" stackId="fees" fill={COLORS.unpaid} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {classFeeStats.length === 0 && (
            <p className="font-ui text-xs text-forest-300 mt-2">No classes yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
