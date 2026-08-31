import { supabase } from "../../lib/supabase";

export interface TermFee {
  term_number: number;
  amount: number | null; // null = not set yet
}

export interface SubscriptionInvoice {
  id: string;
  school_id: string;
  term_id: string;
  term_number: number;
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

// Always returns exactly 3 rows (Term 1/2/3), amount null for any term
// that hasn't had a rate set yet -- callers don't have to special-case
// "missing" vs "explicitly zero".
export async function fetchFeeSchedule(schoolId: string): Promise<TermFee[]> {
  const { data, error } = await supabase
    .from("subscription_fee_schedule")
    .select("term_number, amount")
    .eq("school_id", schoolId);
  if (error) throw new Error(error.message);
  const byTerm = new Map((data ?? []).map((r) => [r.term_number, r.amount]));
  return [1, 2, 3].map((n) => ({ term_number: n, amount: byTerm.get(n) ?? null }));
}

async function fetchCurrentTerm(schoolId: string): Promise<{ id: string; term_number: number } | null> {
  const { data: session } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();
  if (!session) return null;

  const { data: term } = await supabase
    .from("terms")
    .select("id, term_number")
    .eq("session_id", session.id)
    .eq("is_current", true)
    .maybeSingle();
  return term ?? null;
}

export interface SetTermFeeResult {
  invoiceCreated: boolean;
  invoiceSynced: boolean;
  invoiceLocked: boolean;
  noCurrentTerm: boolean;
}

// Sets/updates the standing rate for one term number (a rate card entry,
// not tied to any specific academic session -- it applies whenever that
// term number is current, this session or a future one). If that term
// number happens to BE the school's current term right now, this also
// creates or syncs that term's actual invoice -- but only when the
// invoice doesn't exist yet, or exists with zero payment against it.
// Returns a status the caller can turn into real user feedback instead
// of silently doing nothing when there's no current term to bill.
export async function setTermFee(schoolId: string, termNumber: number, amount: number): Promise<SetTermFeeResult> {
  const { error } = await supabase
    .from("subscription_fee_schedule")
    .upsert(
      { school_id: schoolId, term_number: termNumber, amount, updated_at: new Date().toISOString() },
      { onConflict: "school_id,term_number" }
    );
  if (error) throw new Error(error.message);

  const currentTerm = await fetchCurrentTerm(schoolId);
  if (!currentTerm || currentTerm.term_number !== termNumber) {
    return { invoiceCreated: false, invoiceSynced: false, invoiceLocked: false, noCurrentTerm: !currentTerm };
  }

  const { data: existing } = await supabase
    .from("subscription_invoices")
    .select("id, amount_paid")
    .eq("school_id", schoolId)
    .eq("term_id", currentTerm.id)
    .maybeSingle();

  if (!existing) {
    const { error: insertError } = await supabase
      .from("subscription_invoices")
      .insert({ school_id: schoolId, term_id: currentTerm.id, amount_due: amount });
    if (insertError) throw new Error(insertError.message);
    return { invoiceCreated: true, invoiceSynced: false, invoiceLocked: false, noCurrentTerm: false };
  }
  if (existing.amount_paid > 0) {
    return { invoiceCreated: false, invoiceSynced: false, invoiceLocked: true, noCurrentTerm: false };
  }
  const { error: updateError } = await supabase
    .from("subscription_invoices")
    .update({ amount_due: amount, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (updateError) throw new Error(updateError.message);
  return { invoiceCreated: false, invoiceSynced: true, invoiceLocked: false, noCurrentTerm: false };
}

// Direct edit of one already-issued invoice's amount (distinct from the
// standing rate card) -- blocked once any payment has landed against it.
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

// Only for an invoice with zero payment against it.
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
      term_number: term?.term_number ?? 0,
      term_label: term ? `Term ${term.term_number}` : "Unknown term",
      amount_due: row.amount_due,
      amount_paid: row.amount_paid,
      due_date: row.due_date,
      created_at: row.created_at,
    };
  });
}

export async function fetchInvoicePayments(invoiceId: string): Promise<SubscriptionPayment[]> {
  const { data, error } = await supabase
    .from("subscription_payment_transactions")
    .select("id, amount, status, rrr, created_at")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Idempotent -- safe to call on every page load. Creates the current
// term's invoice from the rate schedule if a rate is set for that term
// number and no invoice exists yet (e.g. the school just rolled over to
// a new term); never touches an existing invoice.
export async function ensureTermSubscriptionInvoice(schoolId: string): Promise<void> {
  const currentTerm = await fetchCurrentTerm(schoolId);
  if (!currentTerm) return;

  const { data: rate } = await supabase
    .from("subscription_fee_schedule")
    .select("amount")
    .eq("school_id", schoolId)
    .eq("term_number", currentTerm.term_number)
    .maybeSingle();
  if (!rate) return;

  const { data: existing } = await supabase
    .from("subscription_invoices")
    .select("id")
    .eq("school_id", schoolId)
    .eq("term_id", currentTerm.id)
    .maybeSingle();
  if (existing) return;

  await supabase.from("subscription_invoices").insert({
    school_id: schoolId,
    term_id: currentTerm.id,
    amount_due: rate.amount,
  });
}

export interface SubscriptionStatusRow {
  school_id: string;
  amount_due: number;
  amount_paid: number;
}

export async function fetchAllCurrentInvoiceStatuses(): Promise<SubscriptionStatusRow[]> {
  const { data, error } = await supabase.from("subscription_invoices").select("school_id, amount_due, amount_paid");
  if (error) throw new Error(error.message);
  return data ?? [];
}
