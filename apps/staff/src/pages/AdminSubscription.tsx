import { useEffect, useState } from "react";
import { CreditCard, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchFeeSchedule,
  ensureTermSubscriptionInvoice,
  fetchSchoolInvoices,
  fetchInvoicePayments,
  initiateSubscriptionPayment,
  type TermFee,
  type SubscriptionInvoice,
  type SubscriptionPayment,
} from "../features/subscription/api";
import { openRemitaCheckout } from "../features/subscription/remitaCheckout";

export default function AdminSubscription() {
  const { profile } = useAuth();
  const [schedule, setSchedule] = useState<TermFee[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  async function load() {
    if (!profile?.school_id) return;
    setLoading(true);
    try {
      setSchedule(await fetchFeeSchedule(profile.school_id));
      await ensureTermSubscriptionInvoice(profile.school_id);
      setInvoices(await fetchSchoolInvoices(profile.school_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id]);

  async function handlePay(invoice: SubscriptionInvoice) {
    const balance = invoice.amount_due - invoice.amount_paid;
    if (balance <= 0.01) return;
    setPayingInvoiceId(invoice.id);
    setError(null);
    try {
      const result = await initiateSubscriptionPayment(invoice.id, balance);
      await openRemitaCheckout({
        publicKey: result.public_key,
        rrr: result.rrr,
        orderId: result.order_id,
        amount: result.amount,
        payerName: result.payer_name,
        payerEmail: result.payer_email,
        narration: `Subscription payment — ${invoice.term_label}`,
        onSuccess: () => load(),
        onError: (res) => setError(`Payment failed: ${JSON.stringify(res)}`),
        onClose: () => setPayingInvoiceId(null),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment");
    } finally {
      setPayingInvoiceId(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Subscription</h1>
        <p className="font-ui text-xs text-forest-300 mt-1">
          Your school's platform subscription, set by NATM. Pay each term to keep the school active.
        </p>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-forest-300">Loading...</p>
      ) : schedule.every((t) => t.amount === null) ? (
        <div className="bg-forest-900 rounded-lg p-6 text-center">
          <CreditCard className="mx-auto text-forest-300 mb-2" size={24} />
          <p className="font-ui text-sm text-forest-300">
            No subscription rates have been set for your school yet — contact NATM if you believe this is a
            mistake.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {schedule.map((t) => (
              <div key={t.term_number} className="bg-forest-900 rounded-lg p-3">
                <p className="font-ui text-xs text-forest-300">Term {t.term_number}</p>
                <p className="font-display text-lg text-forest-100">
                  {t.amount === null ? "—" : `₦${t.amount.toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>

          {invoices.length === 0 ? (
            <p className="font-ui text-sm text-forest-300">No invoices yet for the current term.</p>
          ) : (
            <div className="space-y-2">
              <h2 className="font-ui text-xs text-forest-300 uppercase tracking-wide">Invoice History</h2>
              {invoices.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  paying={payingInvoiceId === inv.id}
                  onPay={() => handlePay(inv)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InvoiceCard({
  invoice,
  paying,
  onPay,
}: {
  invoice: SubscriptionInvoice;
  paying: boolean;
  onPay: () => void;
}) {
  const balance = invoice.amount_due - invoice.amount_paid;
  const isPaid = balance <= 0.01;
  const hasPayments = invoice.amount_paid > 0;

  const [showPayments, setShowPayments] = useState(false);
  const [payments, setPayments] = useState<SubscriptionPayment[] | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);

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
    <div className="bg-forest-900 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-forest-100">{invoice.term_label}</p>
          <p className="font-ui text-xs text-forest-300">
            ₦{invoice.amount_due.toLocaleString()} due · ₦{invoice.amount_paid.toLocaleString()} paid
          </p>
        </div>
        {isPaid ? (
          <span className="font-ui text-xs px-2 py-1 rounded-full bg-success/10 text-success">Paid</span>
        ) : (
          <button
            onClick={onPay}
            disabled={paying}
            className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {paying ? "Starting..." : `Pay ₦${balance.toLocaleString()}`}
          </button>
        )}
      </div>
      {hasPayments && (
        <button
          onClick={togglePayments}
          className="flex items-center gap-1 font-ui text-xs text-forest-300 hover:text-forest-100"
        >
          {showPayments ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Payment history
        </button>
      )}
      {showPayments && (
        <div className="pl-4 space-y-1 border-l border-forest-700">
          {loadingPayments ? (
            <p className="font-ui text-xs text-forest-400">Loading...</p>
          ) : payments && payments.length > 0 ? (
            payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between font-ui text-xs text-forest-400">
                <span>
                  ₦{p.amount.toLocaleString()} · {p.status}
                  {p.rrr ? ` · RRR ${p.rrr}` : ""}
                </span>
                <span>{new Date(p.created_at).toLocaleString()}</span>
              </div>
            ))
          ) : (
            <p className="font-ui text-xs text-forest-400">No payment attempts recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}
