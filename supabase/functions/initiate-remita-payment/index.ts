import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Remita generate-RRR endpoint + auth hash, per Remita's Collection
// Integration doc (SHA512(merchantId + serviceTypeId + orderId + amount + apiKey)).
// REMITA_BASE_URL defaults to their public test/demo host so this stays
// code-complete and swappable to the live host once real merchant
// credentials exist — nothing here has been live-tested yet (no Remita
// merchant account set up as of this build), same status as the
// AI-recommendation pipeline's Anthropic-billing blocker earlier in this
// project. Verify this endpoint path + hash formula against the real
// merchant onboarding docs Remita sends once the account exists —
// the collection API has historically differed slightly by product line.
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
    if (profileError || !callerProfile || callerProfile.role !== "parent") {
      return new Response(JSON.stringify({ error: "Forbidden — parent only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { student_fee_id, amount, partnership_tier } = await req.json();
    if (!student_fee_id || typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "student_fee_id and a positive amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bronze (volunteer/in-kind) never reaches this function -- it has no
    // amount and is recorded via partnership_pledges instead, client-side.
    const VALID_TIERS = ["gold", "silver"];
    if (partnership_tier !== undefined && partnership_tier !== null && !VALID_TIERS.includes(partnership_tier)) {
      return new Response(JSON.stringify({ error: "Invalid partnership_tier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Confirm this parent is actually linked to the student the fee belongs to.
    const { data: feeRow, error: feeError } = await admin
      .from("student_fees")
      .select("id, student_id, fee_type_id, term_id, school_id, amount_due, amount_paid")
      .eq("id", student_fee_id)
      .single();
    if (feeError || !feeRow) {
      return new Response(JSON.stringify({ error: "Fee not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: link } = await admin
      .from("parent_student_links")
      .select("id")
      .eq("parent_id", callerProfile.id)
      .eq("student_id", feeRow.student_id)
      .maybeSingle();
    if (!link) {
      return new Response(JSON.stringify({ error: "This fee doesn't belong to one of your linked children" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remaining = Number(feeRow.amount_due) - Number(feeRow.amount_paid);
    if (amount > remaining + 0.01) {
      return new Response(
        JSON.stringify({ error: `Amount exceeds the remaining balance of ${remaining}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: student } = await admin
      .from("students")
      .select("full_name")
      .eq("id", feeRow.student_id)
      .single();

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

    const orderId = `natm-${crypto.randomUUID()}`;
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
        description: `Fee payment for ${student?.full_name ?? "student"}`,
      }),
    });

    const remitaData = await remitaRes.json().catch(() => null);
    const rrr = remitaData?.RRR ?? remitaData?.data?.rrr ?? remitaData?.rrr;
    if (!remitaRes.ok || !rrr) {
      return new Response(
        JSON.stringify({ error: "Remita RRR generation failed", details: remitaData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await admin.from("payment_transactions").insert({
      school_id: feeRow.school_id,
      student_id: feeRow.student_id,
      fee_type_id: feeRow.fee_type_id,
      term_id: feeRow.term_id,
      initiated_by: callerProfile.id,
      amount,
      status: "pending",
      order_id: orderId,
      rrr,
      partnership_tier: partnership_tier ?? null,
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
