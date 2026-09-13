// Journey range presets shared by every "how has this student progressed
// over time" view -- currently the Parent/Student Progress page, and the
// Admin/Shadow Teacher Daily Log tab. Centralized here so both apps offer
// the exact same set of windows and the exact same "no lower bound" idea
// of what "All" means.

export interface ProgressRangeOption {
  label: string;
  // Trailing days to fetch. `null` means all-time (no lower bound at all --
  // a student's entire logged journey, however far back it goes).
  days: number | null;
}

export const PROGRESS_RANGE_OPTIONS: ProgressRangeOption[] = [
  { label: "1M", days: 30 },
  { label: "2M", days: 60 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
];

export const DEFAULT_PROGRESS_RANGE_DAYS: number | null = 90;

export function sinceDateISO(days: number | null): string | null {
  if (days === null) return null;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().slice(0, 10);
}
