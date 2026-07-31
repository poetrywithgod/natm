-- ============================================================
-- Sessions & Terms integrity constraints
-- Ensures at most one current session per school,
-- and at most one current term per session.
-- ============================================================

-- Only one current academic session per school
create unique index one_current_session_per_school
  on academic_sessions (school_id)
  where is_current;

-- Only one current term per session
create unique index one_current_term_per_session
  on terms (session_id)
  where is_current;
