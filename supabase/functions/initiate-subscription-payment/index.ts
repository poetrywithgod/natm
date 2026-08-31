import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mirrors initiate-remita-payment's Remita integration exactly (same
// generate-RRR call/hash formula, same "not live-tested, no merchant
// account yet" status) -- the only real difference is what gets paid
// for: a subscription_invoices row (the school's own platform fee)
// instead of a student_fees row (a parent paying the school).
const REMITA_BASE_URL = Deno.env.get("REMITA_BASE_URL") ?? "https://remitademo.net/remita/exapp/api/v1/send/api";
const GENERATE_RRR_PATH = "/echannelsvc/merchant/api/paymentinit";

async function sha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("id, role, school_id, full_name")
      .eq("id", user.id)
      .single();
    if (profileError || !callerProfile || callerProfile.role !== "school_admin" || !callerProfile.school_id) {
      return new Response(JSON.stringify({ error: "Forbidden — School Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoice_id, amount } = await req.json();
    if (!invoice_id || typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "invoice_id and a positive amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: invoice, error: invoiceError } = await admin
      .from("subscription_invoices")
      .select("id, school_id, amount_due, amount_paid")
      .eq("id", invoice_id)
      .single();
    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invoice.school_id !== callerProfile.school_id) {
      return new Response(JSON.stringify({ error: "This invoice doesn't belong to your school" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remaining = Number(invoice.amount_due) - Number(invoice.amount_paid);
    if (amount > remaining + 0.01) {
      return new Response(JSON.stringify({ error: `Amount exceeds the remaining balance of ${remaining}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: school } = await admin.from("schools").select("name, contact_email").eq("id", invoice.school_id).single();

    const merchantId = Deno.env.get("REMITA_MERCHANT_ID");
    const apiKey = Deno.env.get("REMITA_API_KEY");
    const serviceTypeId = Deno.env.get("REMITA_SERVICE_TYPE_ID");
    const publicKey = Deno.env.get("REMITA_PUBLIC_KEY");
    if (!merchantId || !apiKey || !serviceTypeId || !publicKey) {
      return new Response(
        JSON.stringify({
          error:
            "Remita isn't configured yet — REMITA_MERCHANT_ID, REMITA_API_KEY, REMITA_SERVICE_TYPE_ID, and REMITA_PUBLIC_KEY need to be set as Supabase secrets once a Remita merchant account exists.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderId = `natm-sub-${crypto.randomUUID()}`;
    const amountStr = amount.toFixed(2);
    const hash = await sha512Hex(`${merchantId}${serviceTypeId}${orderId}${amountStr}${apiKey}`);

    const remitaRes = await fetch(`${REMITA_BASE_URL}${GENERATE_RRR_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `remitaConsumerKey=${merchantId}, remitaConsumerToken=${hash}`,
      },
      body: JSON.stringify({
        serviceTypeId,
        amount: amountStr,
        orderId,
        payerName: callerProfile.full_name,
        payerEmail: user.email,
        payerPhone: "",
        description: `Platform subscription payment for ${school?.name ?? "school"}`,
      }),
    });

    const remitaData = await remitaRes.json().catch(() => null);
    const rrr = remitaData?.RRR ?? remitaData?.data?.rrr ?? remitaData?.rrr;
    if (!remitaRes.ok || !rrr) {
      return new Response(JSON.stringify({ error: "Remita RRR generation failed", details: remitaData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await admin.from("subscription_payment_transactions").insert({
      school_id: invoice.school_id,
      invoice_id: invoice.id,
      initiated_by: callerProfile.id,
      amount,
      status: "pending",
      order_id: orderId,
      rrr,
    });
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        rrr,
        order_id: orderId,
        public_key: publicKey,
        amount,
        payer_name: callerProfile.full_name,
        payer_email: user.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
