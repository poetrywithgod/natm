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

export async function fetchSubscriptionFee(schoolId: string): Promise<number | null> {
  const { data, error } = await supabase.from("schools").select("subscription_fee").eq("id", schoolId).single();
  if (error) throw new Error(error.message);
  return data.subscription_fee;
}

export async function setSubscriptionFee(schoolId: string, fee: number | null): Promise<void> {
  const { error } = await supabase.from("schools").update({ subscription_fee: fee }).eq("id", schoolId);
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

// Idempotent -- safe to call on every SchoolDetail load. Only creates an
// invoice once the school has a subscription_fee set AND has a current
// term; does nothing (silently) otherwise, since either of those being
// absent just means there's nothing to bill yet.
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
