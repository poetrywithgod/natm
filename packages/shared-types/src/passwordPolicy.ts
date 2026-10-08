// One password rule for every app (staff, super-admin, student/parent).
//
// Keep this in step with the Supabase Auth setting (Authentication > Sign In /
// Providers > Password): minimum length 8 and "lowercase, uppercase letters,
// digits and symbols". The special-character list below is the same set
// Supabase accepts, so a password that passes here is never rejected server
// side for being "too weak". Characters outside it (for example the naira
// sign or a pound sign) deliberately do NOT count as special.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_SPECIAL_CHARS = "!@#$%^&*()_+-=[]{};':\"\\|<>?,./`~";

export type PasswordRuleId = "length" | "lower" | "upper" | "number" | "special";

export interface PasswordRuleResult {
  id: PasswordRuleId;
  label: string;
  met: boolean;
}

function hasSpecial(password: string): boolean {
  for (const ch of password) {
    if (PASSWORD_SPECIAL_CHARS.includes(ch)) return true;
  }
  return false;
}

export function evaluatePassword(password: string): PasswordRuleResult[] {
  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: "lower", label: "A lowercase letter", met: /[a-z]/.test(password) },
    { id: "upper", label: "An uppercase letter", met: /[A-Z]/.test(password) },
    { id: "number", label: "A number", met: /[0-9]/.test(password) },
    { id: "special", label: "A special character (for example ! @ # $ %)", met: hasSpecial(password) },
  ];
}

export function isPasswordValid(password: string): boolean {
  return evaluatePassword(password).every((r) => r.met);
}

export const PASSWORD_REQUIREMENTS_SUMMARY =
  "Use at least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character (for example ! @ # $ %).";

/** null when the password is acceptable, otherwise a plain-language message. */
export function passwordProblem(password: string): string | null {
  return isPasswordValid(password) ? null : PASSWORD_REQUIREMENTS_SUMMARY;
}
