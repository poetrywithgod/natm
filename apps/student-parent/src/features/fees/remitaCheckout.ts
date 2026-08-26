// Remita's inline checkout keeps the payer inside the app (a popup/modal
// widget) rather than a full-page redirect. Script URL defaults to
// Remita's public demo/test bundle -- swap VITE_REMITA_INLINE_SCRIPT_URL
// to the live bundle URL once real merchant credentials exist. Not
// live-tested yet (no Remita merchant account as of this build).
const SCRIPT_URL =
  import.meta.env.VITE_REMITA_INLINE_SCRIPT_URL ?? "https://remitademo.net/payment/v1/remita-pay-inline.bundle.js";

declare global {
  interface Window {
    RmPaymentEngine?: {
      init: (config: Record<string, unknown>) => { showPaymentWidget: () => void };
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadRemitaScript(): Promise<void> {
  if (window.RmPaymentEngine) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Remita checkout script"));
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

export interface RemitaCheckoutParams {
  publicKey: string;
  rrr: string;
  orderId: string;
  amount: number;
  payerName: string;
  payerEmail: string;
  narration: string;
  onSuccess: (response: unknown) => void;
  onError: (response: unknown) => void;
  onClose: () => void;
}

export async function openRemitaCheckout(params: RemitaCheckoutParams): Promise<void> {
  await loadRemitaScript();
  if (!window.RmPaymentEngine) throw new Error("Remita checkout unavailable");

  const paymentEngine = window.RmPaymentEngine.init({
    key: params.publicKey,
    transactionId: params.orderId,
    RRR: params.rrr,
    customerId: params.payerEmail,
    firstName: params.payerName,
    email: params.payerEmail,
    amount: params.amount,
    narration: params.narration,
    onSuccess: params.onSuccess,
    onError: params.onError,
    onClose: params.onClose,
  });
  paymentEngine.showPaymentWidget();
}
