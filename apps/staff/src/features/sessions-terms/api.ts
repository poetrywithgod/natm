import { supabase } from "../../lib/supabase";

export interface AcademicSession {
  id: string;
  school_id: string;
  name: string;
  is_current: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  session_id: string;
  term_number: number;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
}

export async function fetchSessions(schoolId: string): Promise<AcademicSession[]> {
  const { data, error } = await supabase
    .from("academic_sessions")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchTerms(sessionId: string): Promise<Term[]> {
  const { data, error } = await supabase
    .from("terms")
    .select("*")
    .eq("session_id", sessionId)
    .order("term_number", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createSession(schoolId: string, name: string): Promise<AcademicSession> {
  const { data, error } = await supabase
    .from("academic_sessions")
    .insert({ school_id: schoolId, name })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createTerm(sessionId: string, termNumber: number): Promise<Term> {
  const { data, error } = await supabase
    .from("terms")
    .insert({ session_id: sessionId, term_number: termNumber })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Sets one session as current for the school, unsetting any previous one first —
// required because the DB constraint rejects two "true" rows before the old one clears.
export async function setCurrentSession(schoolId: string, sessionId: string): Promise<void> {
  const { error: clearError } = await supabase
    .from("academic_sessions")
    .update({ is_current: false })
    .eq("school_id", schoolId)
    .eq("is_current", true);
  if (clearError) throw new Error(clearError.message);

  const { error: setError } = await supabase
    .from("academic_sessions")
    .update({ is_current: true })
    .eq("id", sessionId);
  if (setError) throw new Error(setError.message);
}

// Same clear-then-set pattern for terms, scoped to the session.
export async function setCurrentTerm(sessionId: string, termId: string): Promise<void> {
  const { error: clearError } = await supabase
    .from("terms")
    .update({ is_current: false })
    .eq("session_id", sessionId)
    .eq("is_current", true);
  if (clearError) throw new Error(clearError.message);

  const { error: setError } = await supabase
    .from("terms")
    .update({ is_current: true })
    .eq("id", termId);
  if (setError) throw new Error(setError.message);
}
