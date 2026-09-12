import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchLinkedChildren, type LinkedChild } from "../features/parent/api";
import {
  fetchStudentObservations,
  fetchStudentShadowRecords,
  fetchSubjectNameMap,
  DEFAULT_PROGRESS_RANGE_DAYS,
  type DailyRecordRow,
} from "../features/dailyProgress/api";
import DailyProgressSection from "../features/dailyProgress/components/DailyProgressSection";

export default function ParentChildProgress() {
  const { studentId } = useParams<{ studentId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [child, setChild] = useState<LinkedChild | null>(null);
  const [classObservations, setClassObservations] = useState<DailyRecordRow[]>([]);
  const [shadowObservations, setShadowObservations] = useState<DailyRecordRow[]>([]);
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [rangeDays, setRangeDays] = useState<number | null>(DEFAULT_PROGRESS_RANGE_DAYS);
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load: resolve the linked child + subject name map once.
  useEffect(() => {
    if (!studentId || !profile?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const children = await fetchLinkedChildren(profile.id);
        const found = children.find((c) => c.id === studentId);
        if (!found) {
          if (!cancelled) {
            setError("This child isn't linked to your account.");
            setLoading(false);
          }
          return;
        }
        const [classObs, shadowObs, subjects] = await Promise.all([
          fetchStudentObservations(found.id, rangeDays),
          fetchStudentShadowRecords(found.id, rangeDays),
          fetchSubjectNameMap(),
        ]);
        if (!cancelled) {
          setChild(found);
          setClassObservations(classObs);
          setShadowObservations(shadowObs);
          setSubjectNames(subjects);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load progress");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, profile?.id]);

  // Range changes: refetch just the two observation sets for the new window.
  const handleRangeChange = async (days: number | null) => {
    if (!child || days === rangeDays) {
      setRangeDays(days);
      return;
    }
    setRangeDays(days);
    setRangeLoading(true);
    try {
      const [classObs, shadowObs] = await Promise.all([
        fetchStudentObservations(child.id, days),
        fetchStudentShadowRecords(child.id, days),
      ]);
      setClassObservations(classObs);
      setShadowObservations(shadowObs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load progress");
    } finally {
      setRangeLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={() => navigate("/parent")}
        className="flex items-center gap-1 font-ui text-sm text-abyssal-300 hover:text-abyssal-100"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="font-display text-xl text-abyssal-100">{child ? `${child.full_name}'s Progress` : "Progress"}</h1>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-32 rounded-lg bg-abyssal-900" />
          <div className="h-20 rounded-lg bg-abyssal-900" />
        </div>
      ) : error ? (
        <p className="font-ui text-sm text-error">{error}</p>
      ) : (
        <DailyProgressSection
          classObservations={classObservations}
          shadowObservations={shadowObservations}
          subjectNames={subjectNames}
          childFirstName={child?.full_name.split(" ")[0]}
          selectedRangeDays={rangeDays}
          onRangeChange={handleRangeChange}
          rangeLoading={rangeLoading}
        />
      )}
    </div>
  );
}
