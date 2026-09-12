// Turns the raw rating selections logged on the Daily Teacher Observation
// Form / Shadow Teacher Daily Record into comparable 0-100 scores, so
// Student, Parent, Class Teacher, Shadow Teacher, and School Admin can all
// chart the same underlying numbers from their own apps.
//
// Every rating scale in both forms is authored best-option-first (e.g.
// "Excellent" before "Needs Support", "Independent" before "Full Support"),
// so normalization only needs the option's position in its own scale --
// no per-scale special-casing required.

import type {
  SectionConfig,
  SectionsData,
  RatingTableValue,
  RadioWithNoteValue,
} from "./sectionTypes";

export interface DomainScore {
  sectionKey: string;
  sectionTitle: string;
  rowKey: string;
  rowLabel: string;
  score: number; // 0-100, 100 = best option on that row's scale
}

function scoreForOption(options: string[], selected: string | undefined): number | null {
  if (!selected) return null;
  const idx = options.indexOf(selected);
  if (idx === -1) return null;
  if (options.length === 1) return 100;
  return Math.round((100 * (options.length - 1 - idx)) / (options.length - 1));
}

// Every ratingTable row and every radioWithNote selection in a day's
// `sections` data, scored. Skips anything not yet filled in.
export function extractDomainScores(configs: SectionConfig[], sections: SectionsData): DomainScore[] {
  const results: DomainScore[] = [];
  for (const config of configs) {
    const value = sections[config.key];
    if (!value) continue;
    if (config.type === "ratingTable") {
      const v = value as RatingTableValue;
      for (const row of config.rows) {
        const score = scoreForOption(config.options, v.ratings?.[row.key]);
        if (score !== null) {
          results.push({
            sectionKey: config.key,
            sectionTitle: config.title,
            rowKey: row.key,
            rowLabel: row.label,
            score,
          });
        }
      }
    } else if (config.type === "radioWithNote") {
      const v = value as RadioWithNoteValue;
      const score = scoreForOption(config.options, v.selected);
      if (score !== null) {
        results.push({
          sectionKey: config.key,
          sectionTitle: config.title,
          rowKey: config.key,
          rowLabel: config.title,
          score,
        });
      }
    }
  }
  return results;
}

export interface SubjectScore {
  subjectId: string;
  subjectName: string;
  score: number;
}

// Reads the dynamic per-subject rating section (rows are the subjects the
// class timetable scheduled that day, not a fixed config) out of one day's
// sections data.
export function extractSubjectScores(
  sections: SectionsData,
  sectionKey: string,
  options: string[],
  subjectNames: Record<string, string>
): SubjectScore[] {
  const value = sections[sectionKey] as RatingTableValue | undefined;
  if (!value?.ratings) return [];
  const results: SubjectScore[] = [];
  for (const [subjectId, selected] of Object.entries(value.ratings)) {
    const score = scoreForOption(options, selected);
    if (score !== null) {
      results.push({ subjectId, subjectName: subjectNames[subjectId] ?? "Unknown subject", score });
    }
  }
  return results;
}

export function overallCompositeScore(configs: SectionConfig[], sections: SectionsData): number | null {
  const scores = extractDomainScores(configs, sections);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
}

export interface DailyRecordLike {
  date: string;
  sections: SectionsData;
}

export interface DailyTrendPoint {
  date: string;
  composite: number | null;
  byDomain: Record<string, number>;
}

export function aggregateDomainOverTime(configs: SectionConfig[], records: DailyRecordLike[]): DailyTrendPoint[] {
  return records
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const scores = extractDomainScores(configs, r.sections);
      const grouped: Record<string, number[]> = {};
      for (const s of scores) (grouped[s.rowLabel] ??= []).push(s.score);
      const byDomain: Record<string, number> = {};
      for (const [label, vals] of Object.entries(grouped)) {
        byDomain[label] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
      const composite = scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : null;
      return { date: r.date, composite, byDomain };
    });
}

export interface WeeklyDelta {
  label: string;
  thisWeekAvg: number;
  lastWeekAvg: number;
  deltaPoints: number;
  direction: "improving" | "declining" | "steady";
}

// Trailing-7-days vs the 7 days before that. Only reports a domain when
// both windows have at least one logged value, so a brand-new domain
// doesn't show a misleading 100-point "improvement" from nothing.
export function computeWeeklyDeltas(
  configs: SectionConfig[],
  records: DailyRecordLike[],
  today: Date = new Date()
): WeeklyDelta[] {
  const oneDay = 86400000;
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - 6);
  const startOfLastWeek = new Date(today);
  startOfLastWeek.setDate(today.getDate() - 13);
  const endOfLastWeek = new Date(startOfThisWeek.getTime() - oneDay);

  const isInRange = (dateStr: string, start: Date, end: Date) => {
    const d = new Date(dateStr + "T00:00:00").getTime();
    return d >= start.getTime() && d <= end.getTime();
  };

  const collectByLabel = (recs: DailyRecordLike[]) => {
    const grouped: Record<string, number[]> = {};
    for (const r of recs) {
      for (const s of extractDomainScores(configs, r.sections)) (grouped[s.rowLabel] ??= []).push(s.score);
    }
    const avgs: Record<string, number> = {};
    for (const [label, vals] of Object.entries(grouped)) avgs[label] = vals.reduce((a, b) => a + b, 0) / vals.length;
    return avgs;
  };

  const thisWeekAvgs = collectByLabel(records.filter((r) => isInRange(r.date, startOfThisWeek, today)));
  const lastWeekAvgs = collectByLabel(records.filter((r) => isInRange(r.date, startOfLastWeek, endOfLastWeek)));

  const labels = new Set([...Object.keys(thisWeekAvgs), ...Object.keys(lastWeekAvgs)]);
  const deltas: WeeklyDelta[] = [];
  for (const label of labels) {
    if (thisWeekAvgs[label] === undefined || lastWeekAvgs[label] === undefined) continue;
    const thisWeekAvg = Math.round(thisWeekAvgs[label]);
    const lastWeekAvg = Math.round(lastWeekAvgs[label]);
    const deltaPoints = thisWeekAvg - lastWeekAvg;
    deltas.push({
      label,
      thisWeekAvg,
      lastWeekAvg,
      deltaPoints,
      direction: deltaPoints > 3 ? "improving" : deltaPoints < -3 ? "declining" : "steady",
    });
  }
  return deltas.sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints));
}

// One flagged day per record whose behaviour-record section logged at
// least one behaviour tag -- a simple frequency count for "how often is
// this coming up", not a severity score.
export function countBehaviourIncidents(records: DailyRecordLike[], behaviourSectionKey: string): number {
  let count = 0;
  for (const r of records) {
    const v = r.sections[behaviourSectionKey] as { behaviourTags?: string[] } | undefined;
    if (v?.behaviourTags && v.behaviourTags.length > 0) count++;
  }
  return count;
}

// A single 0-100 term score per student, meant to sit alongside
// attendance/fees as another factor on the Promotion review -- not a
// stored column, just computed on demand from that term's records.
export interface RosterRecordLike extends DailyRecordLike {
  studentId: string;
}

export interface StudentRosterScore {
  studentId: string;
  thisWeekAvg: number | null;
  lastWeekAvg: number | null;
  deltaPoints: number | null;
  direction: "improving" | "declining" | "steady" | "unknown";
}

// Groups a class/caseload/school's raw daily records by student and scores
// each one's trailing week against the week before -- the shared basis for
// every "who needs attention" roster view (Class Teacher, Shadow Teacher,
// School Admin all use this the same way, just with different source rows).
export function computeRosterProgress(
  configs: SectionConfig[],
  rows: RosterRecordLike[],
  today: Date = new Date()
): StudentRosterScore[] {
  const oneDay = 86400000;
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - 6);
  const startOfLastWeek = new Date(today);
  startOfLastWeek.setDate(today.getDate() - 13);
  const endOfLastWeek = new Date(startOfThisWeek.getTime() - oneDay);

  const isInRange = (dateStr: string, start: Date, end: Date) => {
    const d = new Date(dateStr + "T00:00:00").getTime();
    return d >= start.getTime() && d <= end.getTime();
  };

  const byStudent = new Map<string, RosterRecordLike[]>();
  for (const r of rows) {
    if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
    byStudent.get(r.studentId)!.push(r);
  }

  const avgComposite = (recs: RosterRecordLike[]) => {
    const scores = recs.map((r) => overallCompositeScore(configs, r.sections)).filter((s): s is number => s !== null);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  };

  const results: StudentRosterScore[] = [];
  for (const [studentId, recs] of byStudent) {
    const thisWeekAvg = avgComposite(recs.filter((r) => isInRange(r.date, startOfThisWeek, today)));
    const lastWeekAvg = avgComposite(recs.filter((r) => isInRange(r.date, startOfLastWeek, endOfLastWeek)));
    let direction: StudentRosterScore["direction"] = "unknown";
    let deltaPoints: number | null = null;
    if (thisWeekAvg !== null && lastWeekAvg !== null) {
      deltaPoints = thisWeekAvg - lastWeekAvg;
      direction = deltaPoints > 3 ? "improving" : deltaPoints < -3 ? "declining" : "steady";
    }
    results.push({ studentId, thisWeekAvg, lastWeekAvg, deltaPoints, direction });
  }
  return results;
}

export function termCompositeScore(configs: SectionConfig[], records: DailyRecordLike[]): number | null {
  const dailyComposites = records
    .map((r) => overallCompositeScore(configs, r.sections))
    .filter((s): s is number => s !== null);
  if (dailyComposites.length === 0) return null;
  return Math.round(dailyComposites.reduce((a, b) => a + b, 0) / dailyComposites.length);
}

export function termSubjectAverages(
  records: DailyRecordLike[],
  sectionKey: string,
  options: string[],
  subjectNames: Record<string, string>
): SubjectScore[] {
  const grouped: Record<string, { name: string; scores: number[] }> = {};
  for (const r of records) {
    for (const s of extractSubjectScores(r.sections, sectionKey, options, subjectNames)) {
      const entry = (grouped[s.subjectId] ??= { name: s.subjectName, scores: [] });
      entry.scores.push(s.score);
    }
  }
  return Object.entries(grouped).map(([subjectId, { name, scores }]) => ({
    subjectId,
    subjectName: name,
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
}
