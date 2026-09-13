import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  CLASS_TEACHER_OBSERVATION_SECTIONS,
  SHADOW_TEACHER_RECORD_SECTIONS,
  SUBJECT_PERFORMANCE_SECTION_KEY,
  SUBJECT_PERFORMANCE_TITLE,
  SUBJECT_PERFORMANCE_OPTIONS,
  initSections,
  type RatingTableSection,
  type SectionsData,
} from "@natm/shared-types";
import SectionRenderer from "../../observations/components/SectionRenderer";
import type { DailyTeacherObservation } from "../../observations/api";
import type { ShadowTeacherDailyRecord } from "../../shadowRecords/api";

interface LogEntry {
  id: string;
  date: string;
  source: "class" | "shadow";
  status: "draft" | "submitted";
  sections: SectionsData;
}

interface Props {
  classObservations: DailyTeacherObservation[];
  shadowObservations: ShadowTeacherDailyRecord[];
  subjectNames: Record<string, string>;
}

// The subject_performance section's rows are dynamic (whichever subjects
// that record's ratings actually cover), so it's built per-entry from
// whatever's in the data -- same idea as the live form's "today's
// timetable" rows, just resolved from history instead.
function subjectPerformanceConfig(sections: SectionsData, subjectNames: Record<string, string>): RatingTableSection {
  const ratings = (sections[SUBJECT_PERFORMANCE_SECTION_KEY] as { ratings?: Record<string, string> } | undefined)
    ?.ratings ?? {};
  const subjectIds = Object.keys(ratings);
  return {
    type: "ratingTable",
    key: SUBJECT_PERFORMANCE_SECTION_KEY,
    title: SUBJECT_PERFORMANCE_TITLE,
    options: SUBJECT_PERFORMANCE_OPTIONS,
    rows: subjectIds.map((id) => ({ key: id, label: subjectNames[id] ?? "Unknown subject" })),
  };
}

function EntryCard({ entry, subjectNames }: { entry: LogEntry; subjectNames: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const configs = entry.source === "class" ? CLASS_TEACHER_OBSERVATION_SECTIONS : SHADOW_TEACHER_RECORD_SECTIONS;
  const filledSections = initSections(configs, entry.sections);
  const subjectConfig = subjectPerformanceConfig(entry.sections, subjectNames);

  return (
    <div className="bg-forest-900 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 font-ui text-[10px] px-2 py-0.5 rounded-full ${
              entry.source === "class" ? "bg-forest-700 text-forest-100" : "bg-forest-600/60 text-forest-100"
            }`}
          >
            {entry.source === "class" ? "Class Teacher" : "Shadow Teacher"}
          </span>
          <span className="font-ui text-sm text-forest-100 truncate">{new Date(entry.date).toLocaleDateString()}</span>
          {entry.status === "draft" && (
            <span className="font-ui text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning shrink-0">
              Draft
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp size={16} className="text-forest-300 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-forest-300 shrink-0" />
        )}
      </button>

      {open && (
        <div className="p-3 pt-0 space-y-3">
          {configs.map((config) => (
            <SectionRenderer key={config.key} config={config} value={filledSections[config.key]} onChange={() => {}} disabled />
          ))}
          {subjectConfig.rows.length > 0 && (
            <SectionRenderer
              config={subjectConfig}
              value={entry.sections[SUBJECT_PERFORMANCE_SECTION_KEY] ?? { ratings: {}, notes: {} }}
              onChange={() => {}}
              disabled
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function DailyLogEntryList({ classObservations, shadowObservations, subjectNames }: Props) {
  const entries: LogEntry[] = [
    ...classObservations.map(
      (o): LogEntry => ({ id: o.id, date: o.date, source: "class", status: o.status, sections: o.sections })
    ),
    ...shadowObservations.map(
      (o): LogEntry => ({ id: o.id, date: o.date, source: "shadow", status: o.status, sections: o.sections })
    ),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (entries.length === 0) {
    return (
      <div className="bg-forest-900 rounded-lg p-6 text-center">
        <p className="font-ui text-sm text-forest-300">No daily log entries in this range yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <EntryCard key={`${entry.source}-${entry.id}`} entry={entry} subjectNames={subjectNames} />
      ))}
    </div>
  );
}
