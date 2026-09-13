import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  CLASS_TEACHER_OBSERVATION_SECTIONS,
  SHADOW_TEACHER_RECORD_SECTIONS,
  SUBJECT_PERFORMANCE_SECTION_KEY,
  SUBJECT_PERFORMANCE_OPTIONS,
  aggregateDomainOverTime,
  computeWeeklyDeltas,
  extractSubjectScores,
  type SectionConfig,
  type SectionsData,
  type WeeklyDelta,
} from "@natm/shared-types";

const AXIS_TICK = { fill: "#7A9B8E", fontSize: 10 };
const TOOLTIP_STYLE = { background: "#0F2A20", border: "none", borderRadius: 8 };
const TOOLTIP_LABEL_STYLE = { color: "#EAF5EE" };

const CLASS_SUMMARY_ONLY: SectionConfig[] = CLASS_TEACHER_OBSERVATION_SECTIONS.filter(
  (s) => s.key === "daily_functional_summary"
);
const SHADOW_SUMMARY_ONLY: SectionConfig[] = SHADOW_TEACHER_RECORD_SECTIONS.filter(
  (s) => s.key === "daily_support_summary"
);

interface DomainOption {
  label: string;
  source: "class" | "shadow";
}

interface RecordLike {
  date: string;
  sections: SectionsData;
}

function directionIcon(direction: "improving" | "declining" | "steady") {
  if (direction === "improving") return <TrendingUp size={16} className="text-forest-400 shrink-0" />;
  if (direction === "declining") return <TrendingDown size={16} className="text-warning shrink-0" />;
  return <Minus size={16} className="text-forest-500 shrink-0" />;
}

function directionSentence(
  label: string,
  deltaPoints: number,
  direction: "improving" | "declining" | "steady",
  subject: string
) {
  if (direction === "improving") return `${subject} ${label} skills improved by ${deltaPoints}% this week.`;
  if (direction === "declining") return `${subject} ${label} skills dropped by ${Math.abs(deltaPoints)}% this week.`;
  return `${subject} ${label} skills stayed steady this week.`;
}

interface Props {
  classObservations: RecordLike[];
  shadowObservations: RecordLike[];
  subjectNames: Record<string, string>;
  studentFirstName: string;
}

// Skills/behaviour + subject charts, shared by the School Admin and
// Shadow Teacher Daily Log tab. Same scoring engine and same chart shape
// as the Parent/Student Progress page's DailyProgressSection -- ported to
// the staff app's Forest palette rather than Abyssal.
export default function StudentSkillsCharts({
  classObservations,
  shadowObservations,
  subjectNames,
  studentFirstName,
}: Props) {
  const trend = useMemo(() => aggregateDomainOverTime(CLASS_SUMMARY_ONLY, classObservations), [classObservations]);
  const shadowTrend = useMemo(
    () => aggregateDomainOverTime(SHADOW_SUMMARY_ONLY, shadowObservations),
    [shadowObservations]
  );

  const classDeltas = useMemo(() => computeWeeklyDeltas(CLASS_SUMMARY_ONLY, classObservations), [classObservations]);
  const shadowDeltas = useMemo(
    () => computeWeeklyDeltas(SHADOW_SUMMARY_ONLY, shadowObservations),
    [shadowObservations]
  );
  const deltas = useMemo(
    () =>
      [...classDeltas, ...shadowDeltas].sort(
        (a: WeeklyDelta, b: WeeklyDelta) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints)
      ),
    [classDeltas, shadowDeltas]
  );

  const classSummaryRows = useMemo(
    () => (CLASS_SUMMARY_ONLY[0]?.type === "ratingTable" ? CLASS_SUMMARY_ONLY[0].rows : []),
    []
  );
  const shadowSummaryRows = useMemo(
    () => (SHADOW_SUMMARY_ONLY[0]?.type === "ratingTable" ? SHADOW_SUMMARY_ONLY[0].rows : []),
    []
  );

  const domainOptions = useMemo(() => {
    const opts: DomainOption[] = [];
    for (const row of classSummaryRows) {
      if (trend.some((t) => t.byDomain[row.label] !== undefined)) opts.push({ label: row.label, source: "class" });
    }
    for (const row of shadowSummaryRows) {
      if (shadowTrend.some((t) => t.byDomain[row.label] !== undefined))
        opts.push({ label: row.label, source: "shadow" });
    }
    return opts;
  }, [classSummaryRows, shadowSummaryRows, trend, shadowTrend]);

  const [selectedDomain, setSelectedDomain] = useState<DomainOption | null>(null);
  const activeDomain =
    selectedDomain && domainOptions.some((d) => d.label === selectedDomain.label && d.source === selectedDomain.source)
      ? selectedDomain
      : domainOptions[0] ?? null;

  const domainLineData = useMemo(() => {
    if (!activeDomain) return [];
    const source = activeDomain.source === "class" ? trend : shadowTrend;
    return source
      .filter((t) => t.byDomain[activeDomain.label] !== undefined)
      .map((t) => ({ date: t.date.slice(5), score: t.byDomain[activeDomain.label] }));
  }, [activeDomain, trend, shadowTrend]);

  const subjectAverages = useMemo(() => {
    const grouped: Record<string, number[]> = {};
    for (const r of [...classObservations, ...shadowObservations]) {
      for (const s of extractSubjectScores(
        r.sections,
        SUBJECT_PERFORMANCE_SECTION_KEY,
        SUBJECT_PERFORMANCE_OPTIONS,
        subjectNames
      )) {
        (grouped[s.subjectName] ??= []).push(s.score);
      }
    }
    return Object.entries(grouped)
      .map(([name, scores]) => ({ name, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
      .sort((a, b) => b.score - a.score);
  }, [classObservations, shadowObservations, subjectNames]);

  const noData = classObservations.length === 0 && shadowObservations.length === 0;
  const lineData = trend.map((t) => ({ date: t.date.slice(5), score: t.composite }));
  const topDeltas = deltas.slice(0, 3);

  if (noData) {
    return (
      <div className="bg-forest-900 rounded-lg p-6 text-center">
        <p className="font-ui text-sm text-forest-300">No daily activity logged for {studentFirstName} in this range yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lineData.length > 0 && (
        <div className="bg-forest-900 rounded-lg p-4">
          <p className="font-ui text-xs text-forest-300 mb-2">{studentFirstName}'s overall trend</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={AXIS_TICK} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
              <Line type="monotone" dataKey="score" stroke="#5FBF8F" strokeWidth={2.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {topDeltas.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display text-base text-forest-100">This week's highlights</h2>
          {topDeltas.map((d) => (
            <div key={d.label} className="bg-forest-900 rounded-lg p-3 flex items-start gap-2">
              {directionIcon(d.direction)}
              <p className="font-ui text-sm text-forest-100">
                {directionSentence(d.label, d.deltaPoints, d.direction, `${studentFirstName}'s`)}
              </p>
            </div>
          ))}
        </div>
      )}

      {domainOptions.length > 0 && activeDomain && (
        <div className="bg-forest-900 rounded-lg p-4">
          <p className="font-ui text-xs text-forest-300 mb-2">{studentFirstName}'s skills & behaviour</p>
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
            {domainOptions.map((opt) => {
              const active = opt.label === activeDomain.label && opt.source === activeDomain.source;
              return (
                <button
                  key={`${opt.source}:${opt.label}`}
                  onClick={() => setSelectedDomain(opt)}
                  className={`font-ui text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                    active ? "bg-forest-500 text-forest-950" : "bg-forest-800 text-forest-300"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="font-ui text-[10px] text-forest-500 mb-2">
            {activeDomain.source === "class" ? "From Class Teacher's daily observation" : "From Shadow Teacher's daily support record"}
          </p>
          {domainLineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={domainLineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={AXIS_TICK} />
                <YAxis domain={[0, 100]} tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={activeDomain.source === "class" ? "#5FBF8F" : "#7FB2FF"}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-ui text-xs text-forest-500 py-4 text-center">No data for this domain yet.</p>
          )}
        </div>
      )}

      {subjectAverages.length > 0 && (
        <div className="bg-forest-900 rounded-lg p-4">
          <p className="font-ui text-xs text-forest-300 mb-2">{studentFirstName}'s subjects</p>
          <ResponsiveContainer width="100%" height={Math.max(120, subjectAverages.length * 34)}>
            <BarChart data={subjectAverages} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} />
              <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={110} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
              <Bar dataKey="score" fill="#5FBF8F" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
