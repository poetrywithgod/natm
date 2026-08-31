import { supabase } from "../../lib/supabase";

export interface SubscriptionInvoice {
  id: string;
  term_label: string;
  amount_due: number;
  amount_paid: number;
  due_date: string | null;
  created_at: string;
}

export async function fetchSubscriptionFee(schoolId: string): Promise<number | null> {
  const { data, error } = await supabase.from("schools").select("subscription_fee").eq("id", schoolId).single();
  if (error) throw new Error(error.message);
  return data.subscription_fee;
}

// Idempotent -- safe to call on every page load. Creates the current
// term's invoice if the school's fee is set and no invoice exists for
// it yet (e.g. the school just rolled over to a new term); never
// touches an existing invoice, whether paid or not. Mirrors
// apps/super-admin's version of the same function.
export async function ensureTermSubscriptionInvoice(schoolId: string): Promise<void> {
  const { data: school } = await supabase.from("schools").select("subscription_fee").eq("id", schoolId).single();
  if (!school?.subscription_fee) return;

  const { data: session } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (!session) return;

  const { data: term } = await supabase
    .from("terms")
    .select("id")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  if (!term) return;

  const { data: existing } = await supabase
    .from("subscription_invoices")
    .select("id")
    .eq("school_id", schoolId)
    .eq("term_id", term.id)
    .maybeSingle();
  if (existing) return;

  await supabase.from("subscription_invoices").insert({
    school_id: schoolId,
    term_id: term.id,
    amount_due: school.subscription_fee,
  });
}

export async function fetchSchoolInvoices(schoolId: string): Promise<SubscriptionInvoice[]> {
  const { data, error } = await supabase
    .from("subscription_invoices")
    .select("id, amount_due, amount_paid, due_date, created_at, terms(term_number)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const term = row.terms as unknown as { term_number: number } | null;
    return {
      id: row.id,
      term_label: term ? `Term ${term.term_number}` : "Unknown term",
      amount_due: row.amount_due,
      amount_paid: row.amount_paid,
      due_date: row.due_date,
      created_at: row.created_at,
    };
  });
}

export interface SubscriptionPayment {
  id: string;
  amount: number;
  status: string;
  rrr: string | null;
  created_at: string;
}

// Individual Remita payment attempts against one invoice -- the
// invoice's amount_paid is just a running total; this is the actual
// record of each attempt (including failed ones).
export async function fetchInvoicePayments(invoiceId: string): Promise<SubscriptionPayment[]> {
  const { data, error } = await supabase
    .from("subscription_payment_transactions")
    .select("id, amount, status, rrr, created_at")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// supabase.functions.invoke()'s error.message is a generic "Edge Function
// returned a non-2xx status code" -- pulls the real { error } body out of
// error.context, same fix applied everywhere else this pattern is used.
async function parseFunctionError(error: unknown, fallback: string): Promise<Error> {
  const response = (error as { context?: Response } | null)?.context;
  if (response) {
    try {
      const body = await response.json();
      if (body?.error) return new Error(body.error);
    } catch {
      // response wasn't JSON -- fall through to the generic message
    }
  }
  return new Error(error instanceof Error ? error.message : fallback);
}

export interface InitiatePaymentResult {
  rrr: string;
  order_id: string;
  public_key: string;
  amount: number;
  payer_name: string;
  payer_email: string;
}

export async function initiateSubscriptionPayment(invoiceId: string, amount: number): Promise<InitiatePaymentResult> {
  const { data, error } = await supabase.functions.invoke("initiate-subscription-payment", {
    body: { invoice_id: invoiceId, amount },
  });
  if (error) throw await parseFunctionError(error, "Failed to start payment");
  if (data?.error) throw new Error(data.error);
  return data as InitiatePaymentResult;
}
