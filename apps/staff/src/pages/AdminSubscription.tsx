import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchSubscriptionFee,
  fetchSchoolInvoices,
  initiateSubscriptionPayment,
  type SubscriptionInvoice,
} from "../features/subscription/api";
import { openRemitaCheckout } from "../features/subscription/remitaCheckout";

export default function AdminSubscription() {
  const { profile } = useAuth();
  const [fee, setFee] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  async function load() {
    if (!profile?.school_id) return;
    setLoading(true);
    try {
      const [f, inv] = await Promise.all([
        fetchSubscriptionFee(profile.school_id),
        fetchSchoolInvoices(profile.school_id),
      ]);
      setFee(f);
      setInvoices(inv);
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
      ) : fee === null ? (
        <div className="bg-forest-900 rounded-lg p-6 text-center">
          <CreditCard className="mx-auto text-forest-300 mb-2" size={24} />
          <p className="font-ui text-sm text-forest-300">
            No subscription fee has been set for your school yet — contact NATM if you believe this is a mistake.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-forest-900 rounded-lg p-4">
            <p className="font-ui text-xs text-forest-300">Termly fee</p>
            <p className="font-display text-2xl text-forest-100">₦{fee.toLocaleString()}</p>
          </div>

          {invoices.length === 0 ? (
            <p className="font-ui text-sm text-forest-300">No invoices yet for the current term.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => {
                const balance = inv.amount_due - inv.amount_paid;
                const isPaid = balance <= 0.01;
                return (
                  <div key={inv.id} className="flex items-center justify-between bg-forest-900 rounded-lg p-4">
                    <div>
                      <p className="font-display text-forest-100">{inv.term_label}</p>
                      <p className="font-ui text-xs text-forest-300">
                        ₦{inv.amount_due.toLocaleString()} due · ₦{inv.amount_paid.toLocaleString()} paid
                      </p>
                    </div>
                    {isPaid ? (
                      <span className="font-ui text-xs px-2 py-1 rounded-full bg-success/10 text-success">Paid</span>
                    ) : (
                      <button
                        onClick={() => handlePay(inv)}
                        disabled={payingInvoiceId === inv.id}
                        className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
                      >
                        {payingInvoiceId === inv.id ? "Starting..." : `Pay ₦${balance.toLocaleString()}`}
                      </button>
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
