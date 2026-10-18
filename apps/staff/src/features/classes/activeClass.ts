// A class teacher normally owns exactly one class, and every class-teacher
// page was written around that. A homeschool teacher plays every part for
// a family whose children can sit at different levels, so she owns several
// classes. Rather than rewrite each page, "my class" resolves to whichever
// of her classes she last picked (kept per teacher, per browser); with a
// single class the pick is irrelevant, so ordinary class teachers see no
// change at all.

const key = (teacherId: string) => `natm.activeClass.${teacherId}`;

export function getActiveClassId(teacherId: string): string | null {
  try {
    return localStorage.getItem(key(teacherId));
  } catch {
    // Storage can be blocked or empty (private window etc.) -- fall back
    // to the first class rather than failing.
    return null;
  }
}

export function setActiveClassId(teacherId: string, classId: string): void {
  try {
    localStorage.setItem(key(teacherId), classId);
  } catch {
    // Best effort only.
  }
}

// Picks the teacher's remembered class if she still owns it, else the
// first one (callers pass rows already in a stable order).
export function pickActiveClass<T extends { id: string }>(rows: T[], teacherId: string): T | null {
  if (rows.length === 0) return null;
  const remembered = getActiveClassId(teacherId);
  return rows.find((r) => r.id === remembered) ?? rows[0];
}
