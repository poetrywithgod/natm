import { supabase } from "../../lib/supabase";

export interface SubscriptionInvoice {
  id: string;
  school_id: string;
  term_id: string;
  term_label: string;
  amount_due: number;
  amount_paid: number;
  due_date: string | null;
  created_at: string;
}

export interface SubscriptionPayment {
  id: string;
  amount: number;
  status: string;
  rrr: string | null;
  created_at: string;
}

export async function fetchSubscriptionFee(schoolId: string): Promise<number | null> {
  const { data, error } = await supabase.from("schools").select("subscription_fee").eq("id", schoolId).single();
  if (error) throw new Error(error.message);
  return data.subscription_fee;
}

async function fetchCurrentTermId(schoolId: string): Promise<string | null> {
  const { data: session } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (!session) return null;

  const { data: term } = await supabase
    .from("terms")
    .select("id")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  return term?.id ?? null;
}

// Sets the school's standing termly fee, then syncs it into the current
// term's invoice IF one exists and hasn't received any payment yet (an
// invoice with any amount_paid > 0 is locked -- see updateInvoiceAmount
// for the same rule applied to direct edits). No current-term invoice
// yet? One gets created now, same as before. Either way the new fee
// always takes effect for whichever future term's invoice is created
// next, even when the current one is locked.
export async function saveSubscriptionFee(schoolId: string, fee: number | null): Promise<void> {
  const { error } = await supabase.from("schools").update({ subscription_fee: fee }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  if (fee === null) return;

  const termId = await fetchCurrentTermId(schoolId);
  if (!termId) return;

  const { data: existing } = await supabase
    .from("subscription_invoices")
    .select("id, amount_paid")
    .eq("school_id", schoolId)
    .eq("term_id", termId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("subscription_invoices").insert({ school_id: schoolId, term_id: termId, amount_due: fee });
    return;
  }
  if (existing.amount_paid > 0) return; // locked -- payment already made against this term
  await supabase
    .from("subscription_invoices")
    .update({ amount_due: fee, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
}

// Direct edit of one invoice's amount (independent of the standing fee
// field) -- also blocked once any payment has landed against it.
export async function updateInvoiceAmount(invoiceId: string, amountDue: number): Promise<void> {
  const { data: invoice, error: fetchError } = await supabase
    .from("subscription_invoices")
    .select("amount_paid")
    .eq("id", invoiceId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (invoice.amount_paid > 0) {
    throw new Error("This invoice already has a payment recorded against it and can't be edited.");
  }
  const { error } = await supabase
    .from("subscription_invoices")
    .update({ amount_due: amountDue, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
}

// Only for an invoice with zero payment against it -- once money has
// moved, it becomes a real historical record and can't be removed
// (matches the school-level fee/support model's same archive-not-delete
// philosophy once real data exists against something).
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { data: invoice, error: fetchError } = await supabase
    .from("subscription_invoices")
    .select("amount_paid")
    .eq("id", invoiceId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (invoice.amount_paid > 0) {
    throw new Error("This invoice already has a payment recorded against it and can't be deleted.");
  }
  const { error } = await supabase.from("subscription_invoices").delete().eq("id", invoiceId);
  if (error) throw new Error(error.message);
}

export async function fetchSchoolInvoices(schoolId: string): Promise<SubscriptionInvoice[]> {
  const { data, error } = await supabase
    .from("subscription_invoices")
    .select("id, school_id, term_id, amount_due, amount_paid, due_date, created_at, terms(term_number)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const term = row.terms as unknown as { term_number: number } | null;
    return {
      id: row.id,
      school_id: row.school_id,
      term_id: row.term_id,
      term_label: term ? `Term ${term.term_number}` : "Unknown term",
      amount_due: row.amount_due,
      amount_paid: row.amount_paid,
      due_date: row.due_date,
      created_at: row.created_at,
    };
  });
}

// Individual Remita payment attempts against one invoice -- the
// invoice's amount_paid is just a running total; this is the actual
// historical record of each attempt (including failed ones), for
// auditing exactly when/how a payment happened.
export async function fetchInvoicePayments(invoiceId: string): Promise<SubscriptionPayment[]> {
  const { data, error } = await supabase
    .from("subscription_payment_transactions")
    .select("id, amount, status, rrr, created_at")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Idempotent -- safe to call on every SchoolDetail load. Only creates an
// invoice once the school has a subscription_fee set AND has a current
// term; does nothing (silently) otherwise, since either of those being
// absent just means there's nothing to bill yet. Never overwrites an
// existing invoice -- that's saveSubscriptionFee's job now, and only
// when unpaid.
export async function ensureTermSubscriptionInvoice(schoolId: string): Promise<void> {
  const { data: school } = await supabase.from("schools").select("subscription_fee").eq("id", schoolId).single();
  if (!school?.subscription_fee) return;

  const termId = await fetchCurrentTermId(schoolId);
  if (!termId) return;

  const { data: existing } = await supabase
    .from("subscription_invoices")
    .select("id")
    .eq("school_id", schoolId)
    .eq("term_id", termId)
    .maybeSingle();
  if (existing) return;

  await supabase.from("subscription_invoices").insert({
    school_id: schoolId,
    term_id: termId,
    amount_due: school.subscription_fee,
  });
}

// Every school's current-term subscription status, for the Schools list
// and Dashboard's overdue count -- one query rather than N+1.
export interface SubscriptionStatusRow {
  school_id: string;
  amount_due: number;
  amount_paid: number;
}

export async function fetchAllCurrentInvoiceStatuses(): Promise<SubscriptionStatusRow[]> {
  const { data, error } = await supabase.from("subscription_invoices").select("school_id, amount_due, amount_paid");
  if (error) throw new Error(error.message);
  // Multiple invoices per school over time is expected -- callers that
  // care about "right now" should already be scoping by current term
  // where it matters (SchoolDetail does); this flat list is only used
  // for a lightweight "has any overdue invoice ever" signal on the
  // Schools list/Dashboard, not a per-term breakdown.
  return data ?? [];
}
