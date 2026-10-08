// Temporary passwords for accounts an admin creates on someone's behalf.
//
// Must satisfy the project-wide password rule (see
// packages/shared-types/src/passwordPolicy.ts and the Supabase Auth password
// setting): at least 8 characters with a lowercase letter, an uppercase
// letter, a number and a special character. Every generated password has at
// least one of each class.
//
// Uses crypto.getRandomValues (never Math.random) and rejection sampling so
// there is no modulo bias. Visually ambiguous characters (O/0, l/1/I) are
// left out because an admin will often read these out or write them down.

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
// A subset of the symbols Supabase accepts, chosen to survive being typed on
// a phone keyboard and copied through chat apps.
const SYMBOLS = "!@#$%&*?";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

export const TEMP_PASSWORD_LENGTH = 12;

/** Uniform random integer in [0, max) with no modulo bias. */
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

export function generateTemporaryPassword(): string {
  // One guaranteed character from each class, the rest from the full set...
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(pick(ALL));
  // ...then a Fisher-Yates shuffle so the guaranteed ones aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
