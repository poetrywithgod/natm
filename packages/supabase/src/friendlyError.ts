// A thin translation layer between raw errors (Postgres constraint
// violations, PostgREST/GoTrue error strings, network failures, Supabase
// Edge Function boilerplate) and the plain-language message a non-technical
// school admin, teacher, or parent should actually see.
//
// This intentionally does NOT try to rewrite every message. Most errors
// thrown across the apps are already written by us in plain language (e.g.
// "Parent name and email are required.") and are left untouched -- only
// messages matching a known "leaky" pattern get swapped for a friendly one.
// Anything unrecognized still falls through to the original message rather
// than a generic wall of "Something went wrong", since a specific-but-a-bit-
// technical message is still more useful than a vague one.

interface FriendlyPattern {
  test: RegExp;
  friendly: string;
}

const PATTERNS: FriendlyPattern[] = [
  {
    test: /failed to fetch|network ?error|network request failed|err_internet_disconnected|err_connection|load failed|err_name_not_resolved/i,
    friendly: "Couldn't reach the server. Check your internet connection and try again.",
  },
  {
    test: /jwt expired|invalid jwt|invalid refresh token|refresh_token_not_found|session.*missing|session.*expired|not authenticated|auth session missing/i,
    friendly: "Your session has expired. Please log out and log back in.",
  },
  {
    test: /row-level security|permission denied|not authorized|forbidden/i,
    friendly: "You don't have permission to do that.",
  },
  {
    test: /user already registered|already been registered|email_exists/i,
    friendly: "An account with that email already exists.",
  },
  {
    test: /duplicate key value violates unique constraint/i,
    friendly: "That already exists — no changes were needed.",
  },
  {
    test: /violates foreign key constraint/i,
    friendly: "This is linked to other records, so that change can't be made right now.",
  },
  {
    test: /null value in column|violates not-null constraint/i,
    friendly: "Please fill in all required fields.",
  },
  {
    test: /invalid input syntax for type/i,
    friendly: "One of the values entered isn't in the right format. Please check and try again.",
  },
  {
    test: /rate limit|too many requests|status code 429/i,
    friendly: "Too many attempts — please wait a moment and try again.",
  },
  {
    test: /timeout|aborted|timed out/i,
    friendly: "That took too long to respond. Please try again.",
  },
  {
    test: /edge function returned a non-2xx status code/i,
    friendly: "The request didn't go through. Please try again, and let support know if it keeps happening.",
  },
  {
    test: /unexpected token|is not valid json/i,
    friendly: "Something went wrong reading the server's response. Please try again.",
  },
  {
    test: /relation ".*" does not exist|column ".*" does not exist|syntax error at or near/i,
    friendly: "Something went wrong on our end. Please try again, and let support know if it keeps happening.",
  },
];

// Drop-in replacement for the common
//   error instanceof Error ? error.message : fallback
// pattern -- same signature and same fallback behavior when `error` isn't
// an Error, but recognized technical messages get swapped for a friendly
// one first.
export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  const message = error.message;
  const match = PATTERNS.find((p) => p.test.test(message));
  return match ? match.friendly : message;
}
