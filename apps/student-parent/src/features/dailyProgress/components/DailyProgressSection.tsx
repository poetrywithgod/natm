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
  type WeeklyDelta,
} from "@natm/shared-types";
import type { DailyRecordRow } from "../api";
import ProgressRangeTabs from "./ProgressRangeTabs";

const AXIS_TICK = { fill: "#7284A8", fontSize: 10 };
const TOOLTIP_STYLE = { background: "#1F3050", border: "none", borderRadius: 8 };
const TOOLTIP_LABEL_STYLE = { color: "#F6F3EA" };

// Only the seven headline domains from Daily Functional Summary -- the
// one section filled the same way every single day -- are used for the
// student-facing composite trend/callouts. The other sections (arrival
// routine, closing routine, etc.) are more granular than a "how's my
// week going" view needs.
const CLASS_SUMMARY_ONLY: SectionConfig[] = CLASS_TEACHER_OBSERVATION_SECTIONS.filter(
  (s) => s.key === "daily_functional_summary"
);

// Same idea on the Shadow Teacher side: "Daily Support Summary" is the one
// section every Shadow Teacher fills every day, covering Academic Tasks,
// Communication, Behaviour Regulation, Social Interaction, Personal Care,
// Sensory Regulation, and Transitions -- this is the skills/behaviour data
// that previously never reached any chart.
const SHADOW_SUMMARY_ONLY: SectionConfig[] = SHADOW_TEACHER_RECORD_SECTIONS.filter(
  (s) => s.key === "daily_support_summary"
);

interface DomainOption {
  label: string;
  source: "class" | "shadow";
}

function directionIcon(direction: "improving" | "declining" | "steady") {
  if (direction === "improving") return <TrendingUp size={16} className="text-success shrink-0" />;
  if (direction === "declining") return <TrendingDown size={16} className="text-warning shrink-0" />;
  return <Minus size={16} className="text-abyssal-500 shrink-0" />;
}

function directionSentence(
  label: string,
  deltaPoints: number,
  direction: "improving" | "declining" | "steady",
  subject: string
) {
  if (direction === "improving") return `${subject} ${label} skills improved by ${deltaPoints}% this week! 🎉`;
  if (direction === "declining") return `${subject} ${label} skills dropped by ${Math.abs(deltaPoints)}% this week.`;
  return `${subject} ${label} skills stayed steady this week.`;
}

interface Props {
  classObservations: DailyRecordRow[];
  shadowObservations: DailyRecordRow[];
  subjectNames: Record<string, string>;
  // Omit for the student's own view ("Your Attention skills improved...").
  // Pass the child's first name for a parent/teacher viewing someone
  // else's progress ("Amara's Attention skills improved...").
  childFirstName?: string;
  selectedRangeDays: number | null;
  onRangeChange: (days: number | null) => void;
  rangeLoading?: boolean;
}

export default function DailyProgressSection({
  classObservations,
  shadowObservations,
  subjectNames,
  childFirstName,
  selectedRangeDays,
  onRangeChange,
  rangeLoading,
}: Props) {
  const subjectPhrase = childFirstName ? `${childFirstName}'s` : "Your";
  const chartTitle = childFirstName ? `${childFirstName}'s recent activity` : "How I've been doing";

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

  // Every domain label that's shown up in either source over the selected
  // range, so the picker never offers a domain with nothing to plot.
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
  const activeDomain = selectedDomain && domainOptions.some((d) => d.label === selectedDomain.label && d.source === selectedDomain.source)
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

  return (
    <div className="space-y-4">
      <ProgressRangeTabs selectedDays={selectedRangeDays} onChange={onRangeChange} disabled={rangeLoading} />

      {noData ? (
        <div className="bg-abyssal-900 rounded-lg p-6 text-center">
          <p className="font-body text-sm text-abyssal-300">
            {childFirstName
              ? `No daily activity logged for ${childFirstName} in this range yet.`
              : "No daily activity logged for you in this range yet."}
          </p>
        </div>
      ) : (
        <>
          {lineData.length > 0 && (
            <div className="bg-abyssal-900 rounded-lg p-4">
              <p className="font-ui text-xs text-abyssal-300 mb-2">{chartTitle}</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={AXIS_TICK} />
                  <YAxis domain={[0, 100]} tick={AXIS_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                  <Line type="monotone" dataKey="score" stroke="#B8E14A" strokeWidth={2.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {topDeltas.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-display text-base text-abyssal-100">This week's highlights</h2>
              {topDeltas.map((d) => (
                <div key={d.label} className="bg-abyssal-900 rounded-lg p-3 flex items-start gap-2">
                  {directionIcon(d.direction)}
                  <p className="font-ui text-sm text-abyssal-100">
                    {directionSentence(d.label, d.deltaPoints, d.direction, subjectPhrase)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {domainOptions.length > 0 && activeDomain && (
            <div className="bg-abyssal-900 rounded-lg p-4">
              <p className="font-ui text-xs text-abyssal-300 mb-2">
                {childFirstName ? `${childFirstName}'s skills & behaviour` : "My skills & behaviour"}
              </p>
              <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
                {domainOptions.map((opt) => {
                  const active = opt.label === activeDomain.label && opt.source === activeDomain.source;
                  return (
                    <button
                      key={`${opt.source}:${opt.label}`}
                      onClick={() => setSelectedDomain(opt)}
                      className={`font-ui text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                        active ? "bg-lime text-abyssal-950" : "bg-abyssal-800 text-abyssal-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="font-ui text-[10px] text-abyssal-500 mb-2">
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
                      stroke={activeDomain.source === "class" ? "#B8E14A" : "#7FB2FF"}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="font-ui text-xs text-abyssal-500 py-4 text-center">No data for this domain yet.</p>
              )}
            </div>
          )}

          {subjectAverages.length > 0 && (
            <div className="bg-abyssal-900 rounded-lg p-4">
              <p className="font-ui text-xs text-abyssal-300 mb-2">{childFirstName ? `${childFirstName}'s subjects` : "My subjects"}</p>
              <ResponsiveContainer width="100%" height={Math.max(120, subjectAverages.length * 34)}>
                <BarChart data={subjectAverages} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} />
                  <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                  <Bar dataKey="score" fill="#B8E14A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
