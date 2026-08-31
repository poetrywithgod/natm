import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Remita calls this once a transaction settles. Payload shape isn't
// live-verified yet (no Remita merchant account as of this build) — this
// reads the fields Remita's docs describe (RRR + a status/paymentStatus
// field + their own transaction id) but should be checked against the
// real webhook payload once Remita sends onboarding docs. Idempotent by
// design: the DB update below only fires on a genuine pending -> success
// transition, so a duplicate delivery can't double-credit a fee.
//
// Handles two unrelated kinds of payment through one webhook (Remita
// only supports one configured webhook URL per merchant account, so
// both have to land here): a parent paying a school's student_fees
// (payment_transactions) and a school paying its own platform
// subscription (subscription_payment_transactions). Looks up the RRR
// in the first table, then the second, and only proceeds with whichever
// one actually matches.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const rrr: string | undefined = payload?.RRR ?? payload?.rrr;
    const remitaStatus: string | undefined = payload?.status ?? payload?.paymentStatus;
    const remitaTransactionId: string | undefined = payload?.transactionId ?? payload?.paymentReference;

    if (!rrr) {
      return new Response(JSON.stringify({ error: "Missing RRR in webhook payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Remita's success status is typically "00" or "Successful" depending
    // on product line — treat either as success, everything else as failed.
    const isSuccess = remitaStatus === "00" || String(remitaStatus).toLowerCase() === "successful";

    const { data: feeTxn } = await admin
      .from("payment_transactions")
      .select("id, status, amount, student_id, fee_type_id, term_id, school_id")
      .eq("rrr", rrr)
      .maybeSingle();

    if (feeTxn) {
      return handleFeePayment(admin, feeTxn, isSuccess, remitaStatus, remitaTransactionId, corsHeaders);
    }

    const { data: subTxn } = await admin
      .from("subscription_payment_transactions")
      .select("id, status, amount, invoice_id, school_id")
      .eq("rrr", rrr)
      .maybeSingle();

    if (subTxn) {
      return handleSubscriptionPayment(admin, subTxn, isSuccess, remitaStatus, remitaTransactionId, corsHeaders);
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
  isSuccess: boolean,
  remitaStatus: unknown,
  remitaTransactionId: string | undefined,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (txn.status !== "pending") {
    return new Response(JSON.stringify({ ok: true, already_processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isSuccess) {
    await admin
      .from("payment_transactions")
      .update({ status: "failed", failure_reason: String(remitaStatus ?? "unknown"), updated_at: new Date().toISOString() })
      .eq("id", txn.id)
      .eq("status", "pending");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Guarded by .eq("status", "pending") so a duplicate webhook delivery
  // racing this one can't flip it to success twice.
  const { data: updated, error: updateError } = await admin
    .from("payment_transactions")
    .update({
      status: "success",
      remita_transaction_id: remitaTransactionId ?? null,
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
  isSuccess: boolean,
  remitaStatus: unknown,
  remitaTransactionId: string | undefined,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (txn.status !== "pending") {
    return new Response(JSON.stringify({ ok: true, already_processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isSuccess) {
    await admin
      .from("subscription_payment_transactions")
      .update({ status: "failed", failure_reason: String(remitaStatus ?? "unknown"), updated_at: new Date().toISOString() })
      .eq("id", txn.id)
      .eq("status", "pending");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: updated, error: updateError } = await admin
    .from("subscription_payment_transactions")
    .update({
      status: "success",
      remita_transaction_id: remitaTransactionId ?? null,
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
