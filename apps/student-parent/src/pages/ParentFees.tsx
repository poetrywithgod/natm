import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchChildrenFeesDue,
  initiateRemitaPayment,
  registerVolunteerPledge,
  fetchOwnPaymentHistory,
  type ChildFeeRow,
  type PaymentHistoryRow,
  type PartnershipTier,
} from "../features/fees/api";
import { openRemitaCheckout } from "../features/fees/remitaCheckout";
import { useToast } from "../features/toast/ToastContext";
import { fetchSchoolInfo, type FinancialModel } from "../features/schools/api";

const GOLD_MINIMUM = 1_000_000;

const TIER_OPTIONS: { value: PartnershipTier; label: string; blurb: string }[] = [
  { value: "gold", label: "Gold Partner", blurb: `₦${GOLD_MINIMUM.toLocaleString()}+ per contribution` },
  { value: "silver", label: "Silver Partner", blurb: "Any amount you're able to give" },
  { value: "bronze", label: "Bronze Partner", blurb: "Volunteer your time or service — no payment" },
];

export default function ParentFees() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [fees, setFees] = useState<ChildFeeRow[]>([]);
  const [history, setHistory] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [financialModel, setFinancialModel] = useState<FinancialModel>("fees");

  const [payingFee, setPayingFee] = useState<ChildFeeRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [selectedTier, setSelectedTier] = useState<PartnershipTier | null>(null);
  const [pledgeNote, setPledgeNote] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const isPartnership = financialModel === "partnership";

  async function loadAll() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const [feeRows, historyRows, schoolInfo] = await Promise.all([
        fetchChildrenFeesDue(profile.id),
        fetchOwnPaymentHistory(profile.id),
        profile.school_id ? fetchSchoolInfo(profile.school_id) : Promise.resolve(null),
      ]);
      setFees(feeRows);
      setHistory(historyRows);
      setFinancialModel(schoolInfo?.financial_model ?? "fees");
    } catch (err) {
      console.error("Failed to load fees:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  function openPayModal(fee: ChildFeeRow) {
    setPayingFee(fee);
    setPayAmount(fee.is_open_amount ? "" : fee.balance.toFixed(2));
    setSelectedTier(null);
    setPledgeNote("");
    setPayError(null);
  }

  async function handlePledge() {
    if (!payingFee || !profile?.id || !profile.school_id) return;
    setPaySubmitting(true);
    setPayError(null);
    try {
      await registerVolunteerPledge(profile.school_id, payingFee.student_id, profile.id, pledgeNote);
      showToast("Interest registered — the school will reach out to arrange details.", "success");
      setPayingFee(null);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to register interest");
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handlePay() {
    if (!payingFee) return;
    if (isPartnership && !selectedTier) {
      setPayError("Choose a partnership tier to continue.");
      return;
    }
    if (selectedTier === "bronze") {
      return handlePledge();
    }

    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setPayError("Enter a valid amount.");
      return;
    }
    if (selectedTier === "gold" && amount < GOLD_MINIMUM) {
      setPayError(`Gold partnership requires at least ₦${GOLD_MINIMUM.toLocaleString()}.`);
      return;
    }
    if (!payingFee.is_open_amount && amount > payingFee.balance + 0.01) {
      setPayError(`Amount can't exceed the balance of ₦${payingFee.balance.toLocaleString()}.`);
      return;
    }

    setPaySubmitting(true);
    setPayError(null);
    try {
      const result = await initiateRemitaPayment(payingFee.student_fee_id, amount, selectedTier);
      setPaySubmitting(false);
      await openRemitaCheckout({
        publicKey: result.public_key,
        rrr: result.rrr,
        orderId: result.order_id,
        amount: result.amount,
        payerName: result.payer_name,
        payerEmail: result.payer_email,
        narration: `${payingFee.fee_type_name} — ${payingFee.full_name}`,
        onSuccess: () => {
          showToast("Payment successful.", "success");
          setPayingFee(null);
          loadAll();
        },
        onError: () => {
          showToast("Payment failed. Please try again.", "error");
        },
        onClose: () => {
          // Widget dismissed without a definite outcome — refresh so the
          // list reflects reality if the webhook already landed.
          loadAll();
        },
      });
    } catch (err) {
      setPaySubmitting(false);
      setPayError(err instanceof Error ? err.message : "Failed to start payment");
    }
  }

  const groupedByChild = fees.reduce<Record<string, ChildFeeRow[]>>((acc, fee) => {
    (acc[fee.full_name] ??= []).push(fee);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-6">
      <h1 className="font-display text-xl text-abyssal-100">
        {isPartnership ? "Partnership" : "Fees"}
      </h1>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-24 rounded-lg bg-abyssal-900" />
          <div className="h-24 rounded-lg bg-abyssal-900" />
        </div>
      ) : fees.length === 0 ? (
        <div className="bg-abyssal-900 rounded-lg p-6 text-center">
          <CreditCard className="mx-auto text-abyssal-300 mb-2" size={24} />
          <p className="font-body text-sm text-abyssal-300">
            {isPartnership ? "No support due right now." : "No fees due right now."}
          </p>
        </div>
      ) : (
        Object.entries(groupedByChild).map(([childName, childFees]) => (
          <div key={childName} className="space-y-2">
            <h2 className="font-ui text-sm text-abyssal-300">{childName}</h2>
            {childFees.map((fee) => (
              <div key={fee.student_fee_id} className="bg-abyssal-900 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-ui text-sm text-abyssal-100">{fee.fee_type_name}</p>
                  {fee.is_open_amount ? (
                    <span className="font-ui text-xs text-abyssal-300">
                      {fee.amount_paid > 0 ? `₦${fee.amount_paid.toLocaleString()} contributed` : "Open"}
                    </span>
                  ) : fee.balance <= 0 ? (
                    <span className="font-ui text-xs text-success">Paid</span>
                  ) : (
                    <span className="font-ui text-xs text-abyssal-300">
                      ₦{fee.balance.toLocaleString()} due
                    </span>
                  )}
                </div>
                {!fee.is_open_amount && (
                  <div className="flex justify-between font-ui text-xs text-abyssal-300">
                    <span>Due: ₦{fee.amount_due.toLocaleString()}</span>
                    <span>Paid: ₦{fee.amount_paid.toLocaleString()}</span>
                  </div>
                )}
                {(fee.is_open_amount || fee.balance > 0) && (
                  <button
                    onClick={() => openPayModal(fee)}
                    className="w-full mt-1 px-4 py-2 rounded bg-lime text-abyssal-950 font-ui text-sm font-semibold"
                  >
                    {fee.is_open_amount ? "Contribute" : "Pay"}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display text-lg text-abyssal-100">Payment History</h2>
          <div className="bg-abyssal-900 rounded-lg divide-y divide-abyssal-800">
            {history.map((h) => (
              <div key={h.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-ui text-sm text-abyssal-100">
                    {h.fee_type_name} · {h.student_name}
                  </p>
                  <p className="font-ui text-xs text-abyssal-300">
                    {new Date(h.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-ui text-sm text-abyssal-100">₦{h.amount.toLocaleString()}</p>
                  <p
                    className={`font-ui text-xs ${
                      h.status === "success"
                        ? "text-success"
                        : h.status === "failed"
                        ? "text-error"
                        : "text-abyssal-300"
                    }`}
                  >
                    {h.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payingFee && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-20">
          <div className="bg-abyssal-900 rounded-t-lg sm:rounded-lg p-4 w-full sm:max-w-sm space-y-3">
            <h2 className="font-display text-lg text-abyssal-100">
              Pay {payingFee.fee_type_name}
            </h2>
            <p className="font-ui text-xs text-abyssal-300">
              {payingFee.full_name}
              {payingFee.is_open_amount
                ? " · Open contribution — no fixed target"
                : ` · Balance: ₦${payingFee.balance.toLocaleString()}`}
            </p>

            {selectedTier !== "bronze" && (
              <div>
                <label className="font-ui text-xs text-abyssal-300">Amount to pay</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  min={0}
                  max={payingFee.is_open_amount ? undefined : payingFee.balance}
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 font-ui text-sm text-abyssal-100"
                />
                <p className="font-ui text-xs text-abyssal-300 mt-1">
                  {selectedTier === "gold"
                    ? `Gold partnership requires at least ₦${GOLD_MINIMUM.toLocaleString()}.`
                    : payingFee.is_open_amount
                    ? "Contribute whatever amount you'd like."
                    : "You can pay in installments — enter less than the full balance if you'd like."}
                </p>
              </div>
            )}

            {isPartnership && (
              <div>
                <label className="font-ui text-xs text-abyssal-300">
                  Contributing as a...
                </label>
                <div className="mt-1 space-y-2">
                  {TIER_OPTIONS.map((tier) => (
                    <label
                      key={tier.value}
                      className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer ${
                        selectedTier === tier.value
                          ? "border-lime bg-abyssal-800"
                          : "border-abyssal-700 bg-abyssal-950"
                      }`}
                    >
                      <input
                        type="radio"
                        name="partnership_tier"
                        checked={selectedTier === tier.value}
                        onChange={() => setSelectedTier(tier.value)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-ui text-sm text-abyssal-100">{tier.label}</span>
                        <span className="block font-ui text-xs text-abyssal-300">{tier.blurb}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedTier === "bronze" && (
              <div>
                <label className="font-ui text-xs text-abyssal-300">
                  How would you like to help? (optional)
                </label>
                <textarea
                  value={pledgeNote}
                  onChange={(e) => setPledgeNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. weekend maintenance, event setup, transport..."
                  className="mt-1 w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 font-ui text-sm text-abyssal-100"
                />
                <p className="font-ui text-xs text-abyssal-300 mt-1">
                  No payment is needed for Bronze — the school will reach out to arrange details.
                </p>
              </div>
            )}

            {payError && <p className="font-ui text-xs text-error">{payError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setPayingFee(null)}
                className="flex-1 px-4 py-2 rounded bg-abyssal-700 text-abyssal-100 font-ui text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={paySubmitting}
                className="flex-1 px-4 py-2 rounded bg-lime text-abyssal-950 font-ui text-sm font-semibold disabled:opacity-50"
              >
                {paySubmitting
                  ? "Submitting..."
                  : selectedTier === "bronze"
                  ? "Register Interest"
                  : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
