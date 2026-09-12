import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  CLASS_TEACHER_OBSERVATION_SECTIONS,
  SUBJECT_PERFORMANCE_SECTION_KEY,
  SUBJECT_PERFORMANCE_OPTIONS,
  aggregateDomainOverTime,
  computeWeeklyDeltas,
  extractSubjectScores,
  type SectionConfig,
} from "@natm/shared-types";
import type { DailyRecordRow } from "../api";

const AXIS_TICK = { fill: "#7284A8", fontSize: 10 };
const TOOLTIP_STYLE = { background: "#1F3050", border: "none", borderRadius: 8 };
const TOOLTIP_LABEL_STYLE = { color: "#F6F3EA" };

// Only the seven headline domains from Daily Functional Summary -- the
// one section filled the same way every single day -- are used for the
// student-facing trend/callouts. The other sections (arrival routine,
// closing routine, etc.) are more granular than a "how's my week going"
// view needs.
const SUMMARY_ONLY: SectionConfig[] = CLASS_TEACHER_OBSERVATION_SECTIONS.filter(
  (s) => s.key === "daily_functional_summary"
);

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
  observations: DailyRecordRow[];
  subjectNames: Record<string, string>;
  // Omit for the student's own view ("Your Attention skills improved...").
  // Pass the child's first name for a parent/teacher viewing someone
  // else's progress ("Amara's Attention skills improved...").
  childFirstName?: string;
}

export default function DailyProgressSection({ observations, subjectNames, childFirstName }: Props) {
  const subjectPhrase = childFirstName ? `${childFirstName}'s` : "Your";
  const chartTitle = childFirstName ? `${childFirstName}'s recent activity` : "How I've been doing";
  const trend = useMemo(() => aggregateDomainOverTime(SUMMARY_ONLY, observations), [observations]);
  const deltas = useMemo(() => computeWeeklyDeltas(SUMMARY_ONLY, observations), [observations]);

  const subjectAverages = useMemo(() => {
    const grouped: Record<string, number[]> = {};
    for (const r of observations) {
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
  }, [observations, subjectNames]);

  if (observations.length === 0) {
    return (
      <div className="bg-abyssal-900 rounded-lg p-6 text-center">
        <p className="font-body text-sm text-abyssal-300">
          {childFirstName
            ? `No daily activity logged for ${childFirstName} yet. Once a teacher logs one, progress will show up here.`
            : "Your teacher hasn't logged a daily activity for you yet. Once they do, your progress will show up here."}
        </p>
      </div>
    );
  }

  const lineData = trend.map((t) => ({
    date: t.date.slice(5), // MM-DD, compact for a small chart
    score: t.composite,
  }));

  const topDeltas = deltas.slice(0, 3);

  return (
    <div className="space-y-4">
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
    </div>
  );
}
