import { useEffect, useMemo, useState } from "react";
import { Receipt, Wallet, AlertCircle, CheckCircle2 } from "lucide-react";
import { fetchAllInvoices, type SubscriptionInvoice } from "../features/subscriptions/api";
import { fetchSchools, type SchoolRow } from "../features/schools/api";
import StatCard from "../components/StatCard";
import InvoiceRow from "../components/InvoiceRow";

export default function Billing() {
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [schoolFilter, setSchoolFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "outstanding">("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [inv, sc] = await Promise.all([fetchAllInvoices(), fetchSchools()]);
      setInvoices(inv);
      setSchools(sc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const schoolNames = useMemo(() => new Map(schools.map((s) => [s.id, s.name])), [schools]);

  const totals = useMemo(() => {
    let due = 0;
    let paid = 0;
    let overdueCount = 0;
    for (const inv of invoices) {
      due += inv.amount_due;
      paid += inv.amount_paid;
      if (inv.amount_due - inv.amount_paid > 0.01) overdueCount += 1;
    }
    return { due, paid, outstanding: due - paid, overdueCount };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (schoolFilter !== "all" && inv.school_id !== schoolFilter) return false;
      const isPaid = inv.amount_due - inv.amount_paid <= 0.01;
      if (statusFilter === "paid" && !isPaid) return false;
      if (statusFilter === "outstanding" && isPaid) return false;
      return true;
    });
  }, [invoices, schoolFilter, statusFilter]);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100">Billing</h1>
        <p className="font-body text-sm text-slate-400 mt-1">Every subscription invoice across the platform.</p>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Invoiced" value={`₦${totals.due.toLocaleString()}`} icon={Receipt} />
            <StatCard label="Total Collected" value={`₦${totals.paid.toLocaleString()}`} icon={CheckCircle2} />
            <StatCard label="Outstanding" value={`₦${totals.outstanding.toLocaleString()}`} icon={Wallet} />
            <StatCard label="Overdue Invoices" value={totals.overdueCount} icon={AlertCircle} />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-ui text-sm max-w-[14rem]"
            >
              <option value="all">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "paid" | "outstanding")}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-ui text-sm"
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="outstanding">Outstanding</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <Receipt className="mx-auto text-slate-600 mb-2" size={28} />
              <p className="font-ui text-sm text-slate-400">
                {invoices.length === 0
                  ? "No invoices yet — they're created from each school's Subscription page."
                  : "No invoices match these filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  schoolName={schoolNames.get(inv.school_id) ?? "Unknown school"}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
