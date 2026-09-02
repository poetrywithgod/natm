import { supabase } from "../../lib/supabase";

export interface SchoolTermStatus {
  school_id: string;
  school_name: string;
  session_name: string | null;
  term_label: string | null;
  term_start: string | null;
  term_end: string | null;
  // Multiple sessions/terms flagged is_current for the same school/session
  // shouldn't be possible (the staff app unsets the old one before setting
  // a new one), but this is a diagnostic view, so surface it rather than
  // silently picking one -- it's exactly the kind of data problem that
  // would otherwise only show up as "why is this school's revenue ₦0".
  hasDuplicateCurrentSession: boolean;
  hasDuplicateCurrentTerm: boolean;
}

// Read-only oversight -- actually setting a school's current session/term
// stays a School Admin job in the staff app (features/sessions-terms).
// This exists so a missing current term (which silently zeroes that
// school out of fetchRevenueSummary) is visible before it's a mystery.
export async function fetchTermsOverview(): Promise<SchoolTermStatus[]> {
  const [{ data: schools, error: schoolsError }, { data: sessions, error: sessionsError }, { data: terms, error: termsError }] =
    await Promise.all([
      supabase.from("schools").select("id, name").order("name"),
      supabase.from("academic_sessions").select("id, school_id, name, is_current"),
      supabase.from("terms").select("id, session_id, term_number, start_date, end_date, is_current"),
    ]);
  if (schoolsError) throw new Error(schoolsError.message);
  if (sessionsError) throw new Error(sessionsError.message);
  if (termsError) throw new Error(termsError.message);

  return (schools ?? []).map((school) => {
    const currentSessions = (sessions ?? []).filter((s) => s.school_id === school.id && s.is_current);
    const currentSession = currentSessions[0] ?? null;
    const termsInSession = currentSession
      ? (terms ?? []).filter((t) => t.session_id === currentSession.id && t.is_current)
      : [];
    const currentTerm = termsInSession[0] ?? null;

    return {
      school_id: school.id,
      school_name: school.name,
      session_name: currentSession?.name ?? null,
      term_label: currentTerm ? `Term ${currentTerm.term_number}` : null,
      term_start: currentTerm?.start_date ?? null,
      term_end: currentTerm?.end_date ?? null,
      hasDuplicateCurrentSession: currentSessions.length > 1,
      hasDuplicateCurrentTerm: termsInSession.length > 1,
    };
  });
}
