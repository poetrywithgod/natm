import { useEffect, useState } from "react";
import { DEFAULT_PROGRESS_RANGE_DAYS } from "@natm/shared-types";
import { fetchObservationsForRange, fetchShadowRecordsForRange, fetchSubjectNameMap } from "../api";
import type { DailyTeacherObservation } from "../../observations/api";
import type { ShadowTeacherDailyRecord } from "../../shadowRecords/api";
import DailyLogRangeTabs from "./DailyLogRangeTabs";
import StudentSkillsCharts from "./StudentSkillsCharts";
import DailyLogEntryList from "./DailyLogEntryList";

interface Props {
  studentId: string;
  studentFirstName: string;
}

// Self-contained Daily Log tab: owns its own range state + fetches, so it
// drops into either Admin's or Shadow Teacher's Student Detail page
// without either page needing to know about ranges or the two source
// tables. Combines the Skills & Behaviour / Subject charts with a
// browsable list of the raw entries behind them.
export default function DailyLogTab({ studentId, studentFirstName }: Props) {
  const [rangeDays, setRangeDays] = useState<number | null>(DEFAULT_PROGRESS_RANGE_DAYS);
  const [classObservations, setClassObservations] = useState<DailyTeacherObservation[]>([]);
  const [shadowObservations, setShadowObservations] = useState<ShadowTeacherDailyRecord[]>([]);
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const [classObs, shadowObs, subjects] = await Promise.all([
          fetchObservationsForRange(studentId, rangeDays),
          fetchShadowRecordsForRange(studentId, rangeDays),
          fetchSubjectNameMap(),
        ]);
        if (!cancelled) {
          setClassObservations(classObs);
          setShadowObservations(shadowObs);
          setSubjectNames(subjects);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load daily log");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleRangeChange = async (days: number | null) => {
    if (days === rangeDays) return;
    setRangeDays(days);
    setRangeLoading(true);
    setError(null);
    try {
      const [classObs, shadowObs] = await Promise.all([
        fetchObservationsForRange(studentId, days),
        fetchShadowRecordsForRange(studentId, days),
      ]);
      setClassObservations(classObs);
      setShadowObservations(shadowObs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load daily log");
    } finally {
      setRangeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-32 rounded-lg bg-forest-900" />
        <div className="h-20 rounded-lg bg-forest-900" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DailyLogRangeTabs selectedDays={rangeDays} onChange={handleRangeChange} disabled={rangeLoading} />

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      <StudentSkillsCharts
        classObservations={classObservations}
        shadowObservations={shadowObservations}
        subjectNames={subjectNames}
        studentFirstName={studentFirstName}
      />

      <div className="space-y-2">
        <h2 className="font-display text-base text-forest-100">Daily log entries</h2>
        <DailyLogEntryList
          classObservations={classObservations}
          shadowObservations={shadowObservations}
          subjectNames={subjectNames}
        />
      </div>
    </div>
  );
}
