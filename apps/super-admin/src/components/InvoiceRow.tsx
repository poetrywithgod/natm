import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  updateInvoiceAmount,
  deleteInvoice,
  fetchInvoicePayments,
  type SubscriptionInvoice,
  type SubscriptionPayment,
} from "../features/subscriptions/api";

// Shared by SchoolDetail (one school's invoice history) and the global
// Billing page (every school's invoices) -- schoolName/schoolLink are only
// passed by the latter, since SchoolDetail already has that context on
// the page and doesn't need it repeated per row.
export default function InvoiceRow({
  invoice,
  onChanged,
  schoolName,
}: {
  invoice: SubscriptionInvoice;
  onChanged: () => Promise<void>;
  schoolName?: string;
}) {
  const balance = invoice.amount_due - invoice.amount_paid;
  const isPaid = balance <= 0.01;
  const isLocked = invoice.amount_paid > 0; // any payment at all, partial or full

  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(String(invoice.amount_due));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPayments, setShowPayments] = useState(false);
  const [payments, setPayments] = useState<SubscriptionPayment[] | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);

  async function handleSaveEdit() {
    const amount = Number(editAmount);
    if (Number.isNaN(amount) || amount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateInvoiceAmount(invoice.id, amount);
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the ${invoice.term_label} invoice? This can't be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteInvoice(invoice.id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete invoice");
      setSaving(false);
    }
  }

  async function togglePayments() {
    if (!showPayments && payments === null) {
      setLoadingPayments(true);
      try {
        setPayments(await fetchInvoicePayments(invoice.id));
      } catch {
        setPayments([]);
      } finally {
        setLoadingPayments(false);
      }
    }
    setShowPayments((v) => !v);
  }

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-body text-sm text-slate-100">{invoice.term_label}</p>
            {schoolName && (
              <Link
                to={`/schools/${invoice.school_id}`}
                className="font-ui text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 hover:text-amber-400"
              >
                {schoolName}
              </Link>
            )}
          </div>
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={0}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-28 p-1 rounded bg-slate-700 border border-slate-600 text-slate-100 font-body text-xs"
              />
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="font-ui text-xs text-amber-400 hover:underline disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditAmount(String(invoice.amount_due));
                  setError(null);
                }}
                className="font-ui text-xs text-slate-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="font-ui text-xs text-slate-400">
              ₦{invoice.amount_due.toLocaleString()} due · ₦{invoice.amount_paid.toLocaleString()} paid
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-ui text-xs px-2 py-0.5 rounded-full ${
              isPaid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}
          >
            {isPaid ? "Paid" : "Outstanding"}
          </span>
          {!isLocked && !editing && (
            <>
              <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-amber-400" aria-label="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={handleDelete} disabled={saving} className="text-slate-400 hover:text-error" aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="font-ui text-xs text-error">{error}</p>}
      {isLocked && (
        <button
          onClick={togglePayments}
          className="flex items-center gap-1 font-ui text-xs text-slate-400 hover:text-slate-100"
        >
          {showPayments ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Payment history
        </button>
      )}
      {showPayments && (
        <div className="pl-4 space-y-1 border-l border-slate-700">
          {loadingPayments ? (
            <p className="font-ui text-xs text-slate-500">Loading...</p>
          ) : payments && payments.length > 0 ? (
            payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between font-ui text-xs text-slate-400">
                <span>
                  ₦{p.amount.toLocaleString()} · {p.status}
                  {p.rrr ? ` · RRR ${p.rrr}` : ""}
                </span>
                <span>{new Date(p.created_at).toLocaleString()}</span>
              </div>
            ))
          ) : (
            <p className="font-ui text-xs text-slate-500">No payment attempts recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}
