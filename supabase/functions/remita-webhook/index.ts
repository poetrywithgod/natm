import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Remita calls this once a transaction settles. SECURITY: this endpoint is
// necessarily public (Supabase Edge Functions have no auth of their own, and
// Remita's servers can't send a Supabase JWT anyway) -- so the incoming
// payload's RRR/status fields are NEVER trusted on their own. A parent
// legitimately sees their own RRR client-side (Remita's checkout widget
// needs it), so without this check anyone could POST a fake
// {"RRR": "<their own rrr>", "status": "00"} here and get a fee marked paid
// without ever paying. Same risk applies to a school forging its own
// subscription payment.
//
// Fix: the incoming call is treated as nothing but a "go check RRR X"
// trigger. Before crediting anything, verifyPaymentWithRemita() independently
// queries Remita's own Payment Status Query API server-to-server, using our
// own merchant secret (never anything from the caller), and only what THAT
// call reports is trusted. Endpoint path + hash field order below follow
// Remita's Collection Integration doc as described
// (SHA512(RRR + apiKey + merchantId) for the status-check hash) -- same
// "verify against the real onboarding docs once a merchant account exists"
// caveat as initiate-remita-payment; this hasn't been live-tested against
// Remita's actual servers, since no merchant account exists yet. If the
// path or hash order turns out wrong once real docs arrive, this fails
// CLOSED (verified: false -> 502, nothing gets credited), not open.
//
// Idempotent by design: the DB update below only fires on a genuine
// pending -> success transition, so a duplicate delivery can't double-credit
// a fee.
//
// Handles two unrelated kinds of payment through one webhook (Remita only
// supports one configured webhook URL per merchant account, so both have to
// land here): a parent paying a school's student_fees (payment_transactions)
// and a school paying its own platform subscription
// (subscription_payment_transactions). Looks up the RRR in the first table,
// then the second, and only proceeds with whichever one actually matches.

const REMITA_BASE_URL = Deno.env.get("REMITA_BASE_URL") ?? "https://remitademo.net/remita/exapp/api/v1/send/api";
const STATUS_QUERY_PATH = "/echannelsvc/merchant/api/paymentstatus";

async function sha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface RemitaVerification {
  verified: boolean;
  isSuccess: boolean;
  status?: string;
  remitaTransactionId?: string;
  remitaAmount?: number;
}

// Independently asks Remita whether RRR actually succeeded. Never trusts the
// webhook request body's own status field -- this is the only source of
// truth the rest of the function is allowed to act on.
async function verifyPaymentWithRemita(rrr: string): Promise<RemitaVerification> {
  const merchantId = Deno.env.get("REMITA_MERCHANT_ID");
  const apiKey = Deno.env.get("REMITA_API_KEY");
  if (!merchantId || !apiKey) {
    // Remita isn't configured -- can't verify anything, so refuse to trust
    // the webhook rather than silently crediting on an unverifiable claim.
    return { verified: false, isSuccess: false };
  }

  const hash = await sha512Hex(`${rrr}${apiKey}${merchantId}`);
  const res = await fetch(`${REMITA_BASE_URL}${STATUS_QUERY_PATH}/${merchantId}/${rrr}/${hash}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  }).catch(() => null);

  if (!res || !res.ok) {
    return { verified: false, isSuccess: false };
  }

  const data = await res.json().catch(() => null);
  if (!data) {
    return { verified: false, isSuccess: false };
  }

  const status: string | undefined = data.status ?? data.paymentStatus ?? data?.data?.status;
  const isSuccess = status === "00" || String(status).toLowerCase() === "successful";
  const remitaTransactionId: string | undefined =
    data.transactionId ?? data.paymentReference ?? data?.data?.transactionId;
  const remitaAmount = data.amount !== undefined ? Number(data.amount) : undefined;

  return { verified: true, isSuccess, status, remitaTransactionId, remitaAmount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const rrr: string | undefined = payload?.RRR ?? payload?.rrr;

    if (!rrr) {
      return new Response(JSON.stringify({ error: "Missing RRR in webhook payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const verification = await verifyPaymentWithRemita(rrr);
    if (!verification.verified) {
      // Can't confirm anything right now (Remita unreachable or REMITA_*
      // secrets not set). Return 502 so Remita's own retry mechanism
      // re-delivers later, instead of silently accepting or silently
      // dropping a possibly-real payment.
      return new Response(JSON.stringify({ error: "Could not verify payment status with Remita" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: feeTxn } = await admin
      .from("payment_transactions")
      .select("id, status, amount, student_id, fee_type_id, term_id, school_id")
      .eq("rrr", rrr)
      .maybeSingle();

    if (feeTxn) {
      return handleFeePayment(admin, feeTxn, verification, corsHeaders);
    }

    const { data: subTxn } = await admin
      .from("subscription_payment_transactions")
      .select("id, status, amount, invoice_id, school_id")
      .eq("rrr", rrr)
      .maybeSingle();

    if (subTxn) {
      return handleSubscriptionPayment(admin, subTxn, verification, corsHeaders);
    }

    return new Response(JSON.stringify({ error: "Unknown RRR" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function handleFeePayment(
  admin: any,
  txn: any,
  verification: RemitaVerification,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (txn.status !== "pending") {
    return new Response(JSON.stringify({ ok: true, already_processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!verification.isSuccess) {
    await admin
      .from("payment_transactions")
      .update({
        status: "failed",
        failure_reason: String(verification.status ?? "unknown"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", txn.id)
      .eq("status", "pending");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cross-check: Remita's own verified amount vs. what we expect to credit.
  // Doesn't block the credit (amount here comes from our own DB, set and
  // range-checked during initiate-remita-payment, not from this request), but
  // a mismatch means something's worth a human looking at.
  if (
    verification.remitaAmount !== undefined &&
    Math.abs(verification.remitaAmount - Number(txn.amount)) > 0.01
  ) {
    console.warn(
      `remita-webhook: amount mismatch on txn ${txn.id} -- Remita reports ${verification.remitaAmount}, expected ${txn.amount}`
    );
  }

  // Guarded by .eq("status", "pending") so a duplicate webhook delivery
  // racing this one can't flip it to success twice.
  const { data: updated, error: updateError } = await admin
    .from("payment_transactions")
    .update({
      status: "success",
      remita_transaction_id: verification.remitaTransactionId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", txn.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) {
    return new Response(JSON.stringify({ ok: true, already_processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: feeRow, error: feeFetchError } = await admin
    .from("student_fees")
    .select("id, amount_paid")
    .eq("student_id", txn.student_id)
    .eq("fee_type_id", txn.fee_type_id)
    .single();
  if (feeFetchError || !feeRow) throw new Error(feeFetchError?.message ?? "student_fees row not found");

  const { error: feeUpdateError } = await admin
    .from("student_fees")
    .update({
      amount_paid: Number(feeRow.amount_paid) + Number(txn.amount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", feeRow.id);
  if (feeUpdateError) throw new Error(feeUpdateError.message);

  // Notify Finance Managers, same pattern as manually-recorded payments.
  const { data: student } = await admin.from("students").select("full_name").eq("id", txn.student_id).single();
  const { data: feeType } = await admin.from("fee_types").select("name").eq("id", txn.fee_type_id).single();
  const { data: recipients } = await admin
    .from("profiles")
    .select("id")
    .eq("school_id", txn.school_id)
    .eq("role", "finance_manager")
    .eq("is_active", true);

  if (recipients && recipients.length > 0) {
    const formattedAmount = `₦${Number(txn.amount).toLocaleString()}`;
    await admin.from("notifications").insert(
      recipients.map((r: { id: string }) => ({
        school_id: txn.school_id,
        recipient_id: r.id,
        type: "payment_recorded",
        title: "Payment recorded",
        body: `${student?.full_name ?? "A student"} paid ${formattedAmount} towards ${feeType?.name ?? "a fee"} online.`,
        related_entity_type: "student_fees",
        related_entity_id: txn.student_id,
      }))
    );
    admin.functions.invoke("send-push", { body: {} }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function handleSubscriptionPayment(
  admin: any,
  txn: any,
  verification: RemitaVerification,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (txn.status !== "pending") {
    return new Response(JSON.stringify({ ok: true, already_processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!verification.isSuccess) {
    await admin
      .from("subscription_payment_transactions")
      .update({
        status: "failed",
        failure_reason: String(verification.status ?? "unknown"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", txn.id)
      .eq("status", "pending");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (
    verification.remitaAmount !== undefined &&
    Math.abs(verification.remitaAmount - Number(txn.amount)) > 0.01
  ) {
    console.warn(
      `remita-webhook: amount mismatch on subscription txn ${txn.id} -- Remita reports ${verification.remitaAmount}, expected ${txn.amount}`
    );
  }

  const { data: updated, error: updateError } = await admin
    .from("subscription_payment_transactions")
    .update({
      status: "success",
      remita_transaction_id: verification.remitaTransactionId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", txn.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) {
    return new Response(JSON.stringify({ ok: true, already_processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: invoice, error: invoiceFetchError } = await admin
    .from("subscription_invoices")
    .select("id, amount_paid")
    .eq("id", txn.invoice_id)
    .single();
  if (invoiceFetchError || !invoice) throw new Error(invoiceFetchError?.message ?? "subscription_invoices row not found");

  const { error: invoiceUpdateError } = await admin
    .from("subscription_invoices")
    .update({
      amount_paid: Number(invoice.amount_paid) + Number(txn.amount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);
  if (invoiceUpdateError) throw new Error(invoiceUpdateError.message);

  // Notify every super_admin (this is a school-paying-the-platform event,
  // not a school-internal one, so it goes to the platform-wide role
  // rather than any school_id-scoped notifications list).
  const { data: school } = await admin.from("schools").select("name").eq("id", txn.school_id).single();
  const { data: recipients } = await admin.from("profiles").select("id").eq("role", "super_admin");

  if (recipients && recipients.length > 0) {
    const formattedAmount = `₦${Number(txn.amount).toLocaleString()}`;
    await admin.from("audit_logs").insert({
      school_id: txn.school_id,
      actor_id: null,
      action: "subscription.paid",
      entity_type: "subscription_invoice",
      entity_id: txn.invoice_id,
      details: { amount: txn.amount },
    });
    console.log(
      `Subscription payment received: ${school?.name ?? "a school"} paid ${formattedAmount} (invoice ${txn.invoice_id})`
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
