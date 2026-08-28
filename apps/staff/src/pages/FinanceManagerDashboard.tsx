import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchSchoolInfo, type FinancialModel } from "../features/schools/api";
import {
  fetchCurrentTerm,
  fetchFeesSummary,
  fetchFeeTypes,
  ensureQuarterlyCDS,
  fetchStudentFeeRowsForType,
  fetchAnnualRevenue,
  fetchPartnershipTierStats,
  summarizeByClass,
  type CurrentTerm,
  type FeeTypeSummary,
  type FeeType,
  type ClassFeeBreakdown,
  type PartnershipTierStat,
} from "../features/fees/api";

const COLORS = {
  paid: "#3D8A4E", // forest-500
  outstanding: "#EF4444", // error
  grid: "#1F4A2C", // forest-700
};

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-forest-900 rounded-lg p-4">
      <p className="font-ui text-xs text-forest-300">{label}</p>
      <p className="font-display text-2xl text-forest-100 mt-1">{value}</p>
    </div>
  );
}

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

function FeeProgressBar({ summary }: { summary: FeeTypeSummary }) {
  const pct = summary.total_due > 0 ? Math.min(100, (summary.total_paid / summary.total_due) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="font-ui text-sm text-forest-100">{summary.fee_type_name}</span>
        <span className="font-ui text-xs text-forest-300">
          {formatNaira(summary.total_paid)} / {formatNaira(summary.total_due)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-forest-700 overflow-hidden">
        <div className="h-full bg-forest-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TierBar({ stat, maxCount }: { stat: PartnershipTierStat; maxCount: number }) {
  const pct = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
  const tierColors: Record<string, string> = {
    gold: "#D9A441",
    silver: "#94A3B8",
    bronze: "#B45309",
  };
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="font-ui text-sm text-forest-100">{stat.label}</span>
        <span className="font-ui text-xs text-forest-300">
          {stat.count} {stat.count === 1 ? "partner" : "partners"}
          {stat.tier !== "bronze" ? ` · ${formatNaira(stat.totalAmount)}` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-forest-700 overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: tierColors[stat.tier] }}
        />
      </div>
    </div>
  );
}

export default function FinanceManagerDashboard() {
  const { profile } = useAuth();
  const [term, setTerm] = useState<CurrentTerm | null>(null);
  const [financialModel, setFinancialModel] = useState<FinancialModel>("fees");
  const [summary, setSummary] = useState<FeeTypeSummary[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState<string | null>(null);
  const [classBreakdown, setClassBreakdown] = useState<ClassFeeBreakdown[]>([]);
  const [annualRevenue, setAnnualRevenue] = useState<number>(0);
  const [tierStats, setTierStats] = useState<PartnershipTierStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schoolId = profile?.school_id;
  const currentYear = new Date().getFullYear();

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const [currentTerm, revenue, schoolInfo] = await Promise.all([
        fetchCurrentTerm(schoolId),
        fetchAnnualRevenue(schoolId, currentYear),
        fetchSchoolInfo(schoolId),
      ]);
      setTerm(currentTerm);
      setAnnualRevenue(revenue);
      const model = schoolInfo?.financial_model ?? "fees";
      setFinancialModel(model);
      if (model === "partnership") {
        fetchPartnershipTierStats(schoolId)
          .then(setTierStats)
          .catch((e) => console.error("Failed to load tier stats:", e));
      }
      if (currentTerm) {
        if (model === "partnership") {
          await ensureQuarterlyCDS(schoolId, currentTerm.id, profile!.id);
        }
        const [s, types] = await Promise.all([
          fetchFeesSummary(schoolId, currentTerm.id),
          fetchFeeTypes(schoolId, currentTerm.id),
        ]);
        setSummary(s);
        setFeeTypes(types);
        setSelectedFeeTypeId((prev) => prev ?? types[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    async function loadBreakdown() {
      if (!selectedFeeTypeId) {
        setClassBreakdown([]);
        return;
      }
      setBreakdownLoading(true);
      try {
        const rows = await fetchStudentFeeRowsForType(selectedFeeTypeId);
        setClassBreakdown(summarizeByClass(rows));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load class breakdown");
      } finally {
        setBreakdownLoading(false);
      }
    }
    loadBreakdown();
  }, [selectedFeeTypeId]);

  // Realtime: any payment recorded or fee type created anywhere should
  // update the dashboard without a manual refresh.
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`finance_dashboard_${schoolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_fees", filter: `school_id=eq.${schoolId}` },
        () => {
          loadAll();
          if (selectedFeeTypeId) {
            fetchStudentFeeRowsForType(selectedFeeTypeId)
              .then((rows) => setClassBreakdown(summarizeByClass(rows)))
              .catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, selectedFeeTypeId]);

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  const totalDue = summary.reduce((sum, s) => sum + s.total_due, 0);
  const totalPaid = summary.reduce((sum, s) => sum + s.total_paid, 0);
  const outstanding = totalDue - totalPaid;

  const chartData = summary.map((s) => ({
    name: s.fee_type_name,
    paid: s.total_paid,
    outstanding: s.total_due - s.total_paid,
  }));

  const classChartData = classBreakdown.map((c) => ({
    name: c.class_name,
    paid: c.paid_students,
    unpaid: c.total_students - c.paid_students,
  }));

  const selectedFeeType = feeTypes.find((f) => f.id === selectedFeeTypeId);
  const isPartnership = financialModel === "partnership";
  const itemsLabel = isPartnership ? "Support Items" : "Fee Types";
  const collectionHeading = isPartnership
    ? "Support Progress by Item"
    : "Collection Progress by Fee Type";
  const byTypeHeading = isPartnership
    ? "Support by Item — Contributed vs Outstanding"
    : "Fees by Type — Paid vs Outstanding";
  const noDataLabel = isPartnership
    ? "No support data yet for the current term."
    : "No fee data yet for the current term.";
  const noItemsAssignedLabel = isPartnership
    ? "No students assigned to this item yet."
    : "No students assigned to this fee yet.";
  const paidByClassLabel = isPartnership ? "Students Contributed by Class" : "Students Paid by Class";

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Dashboard</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      {!term && (
        <p className="font-ui text-sm text-forest-300">
          No current term set — set one under Sessions & Terms to see {isPartnership ? "support" : "fee"} data here.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label={itemsLabel} value={summary.length} />
        <SummaryCard label={`Term Revenue${term ? ` (T${term.term_number})` : ""}`} value={formatNaira(totalPaid)} />
        <SummaryCard label="Outstanding" value={formatNaira(outstanding)} />
        <SummaryCard label={`Annual Revenue (${currentYear})`} value={formatNaira(annualRevenue)} />
      </div>

      {summary.length > 0 && (
        <div className="bg-forest-900 rounded-lg p-4 space-y-4">
          <h2 className="font-display text-lg text-forest-100">{collectionHeading}</h2>
          {summary.map((s) => (
            <FeeProgressBar key={s.fee_type_id} summary={s} />
          ))}
        </div>
      )}

      {isPartnership && (
        <div className="bg-forest-900 rounded-lg p-4 space-y-4">
          <h2 className="font-display text-lg text-forest-100">Partnership Tiers — Which Partners Prefer</h2>
          <p className="font-ui text-xs text-forest-300 -mt-2">
            Gold and Silver counts reflect payment attempts (Remita isn't live yet, so these may
            include pending transactions, not just completed ones). Bronze counts volunteer/in-kind
            pledges registered by parents.
          </p>
          {tierStats.every((t) => t.count === 0) ? (
            <p className="font-ui text-xs text-forest-300">No tier selections recorded yet.</p>
          ) : (
            tierStats.map((t) => (
              <TierBar key={t.tier} stat={t} maxCount={Math.max(...tierStats.map((s) => s.count), 1)} />
            ))
          )}
        </div>
      )}

      <div className="bg-forest-900 rounded-lg p-4">
        <h2 className="font-display text-lg text-forest-100 mb-4">{byTypeHeading}</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#7ED88E" fontSize={12} />
            <YAxis stroke="#7ED88E" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#0F2419", border: "1px solid #1F4A2C", fontSize: 12 }}
              formatter={(value) => formatNaira(Number(value))}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter, sans-serif" }} />
            <Bar dataKey="paid" stackId="fees" fill={COLORS.paid} radius={[0, 0, 0, 0]} />
            <Bar dataKey="outstanding" stackId="fees" fill={COLORS.outstanding} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {chartData.length === 0 && <p className="font-ui text-xs text-forest-300 mt-2">{noDataLabel}</p>}
      </div>

      {feeTypes.length > 0 && (
        <div className="bg-forest-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-display text-lg text-forest-100">{paidByClassLabel}</h2>
            <select
              value={selectedFeeTypeId ?? ""}
              onChange={(e) => setSelectedFeeTypeId(e.target.value || null)}
              className="bg-forest-700 text-forest-100 font-ui text-sm rounded px-2 py-1"
            >
              {feeTypes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {selectedFeeType && (
            <p className="font-ui text-xs text-forest-300 mb-3">
              {selectedFeeType.is_open_amount
                ? "Open contribution — tier-based, no fixed per-student amount"
                : `Per-student amount: ${formatNaira(selectedFeeType.amount)}`}
              {selectedFeeType.class_name ? ` · ${selectedFeeType.class_name} only` : " · whole school"}
            </p>
          )}
          {breakdownLoading ? (
            <p className="font-ui text-sm text-forest-300">Loading...</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={classChartData}>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#7ED88E" fontSize={12} />
                  <YAxis stroke="#7ED88E" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0F2419", border: "1px solid #1F4A2C", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter, sans-serif" }} />
                  <Bar dataKey="paid" stackId="students" fill={COLORS.paid} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="unpaid" stackId="students" fill={COLORS.outstanding} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {classChartData.length === 0 && (
                <p className="font-ui text-xs text-forest-300 mt-2">{noItemsAssignedLabel}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
