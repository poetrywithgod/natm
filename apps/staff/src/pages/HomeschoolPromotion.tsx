import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchClasses, type SchoolClass } from "../features/classes/api";
import { fetchStudents, type Student } from "../features/students/api";
import {
  fetchCurrentSessionId,
  fetchCurrentTermInfo,
  fetchPromotionsForSession,
  fetchTermScores,
  promoteStudent,
} from "../features/promotion/api";
import { suggestPromotion, PASS_MARK } from "../features/promotion/suggest";
import { getFriendlyErrorMessage } from "@natm/supabase";

type Decision = "promoted" | "repeated";
interface Choice {
  decision: Decision;
  toClassId: string;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-error";
}

// Promotion for a homeschool family. The reverse of the school flow: instead
// of the teacher opening each child and deciding, the system proposes an
// outcome for every child from their term score and the teacher confirms it
// or overrides it.
export default function HomeschoolPromotion() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [term, setTerm] = useState<{ termNumber: number; endDate: string | null } | null>(null);
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, Choice>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [cls, studs, sess, termInfo] = await Promise.all([
          fetchClasses(schoolId),
          fetchStudents(schoolId),
          fetchCurrentSessionId(schoolId),
          fetchCurrentTermInfo(schoolId),
        ]);
        setClasses(cls);
        setStudents(studs);
        setSessionId(sess);
        setTerm(termInfo);
        if (sess) setActioned(await fetchPromotionsForSession(schoolId, sess));
        if (termInfo) {
          setScores(
            await fetchTermScores(
              studs.map((s) => s.id),
              termInfo.termNumber
            )
          );
        }
      } catch (e) {
        setLoadError(getFriendlyErrorMessage(e, "Failed to load"));
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId]);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const rows = useMemo(
    () =>
      students.map((s) => {
        const currentClass = s.class_id ? classById.get(s.class_id) ?? null : null;
        const suggestion = suggestPromotion({ score: scores[s.id] ?? null, currentClass, classes });
        const suggested: Choice | null =
          suggestion.decision && suggestion.toClassId
            ? { decision: suggestion.decision, toClassId: suggestion.toClassId }
            : null;
        return { student: s, currentClass, suggestion, suggested, choice: overrides[s.id] ?? suggested };
      }),
    [students, classById, classes, scores, overrides]
  );

  const termOver = term?.endDate ? new Date(term.endDate + "T23:59:59") < new Date() : false;
  const pendingAcceptable = rows.filter((r) => !actioned.has(r.student.id) && r.suggested && !overrides[r.student.id]);

  async function save(studentId: string, choice: Choice) {
    if (!schoolId || !sessionId || !profile?.id) return false;
    const student = students.find((s) => s.id === studentId);
    if (!student) return false;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    try {
      await promoteStudent({
        school_id: schoolId,
        student_id: studentId,
        from_class_id: student.class_id,
        to_class_id: choice.toClassId,
        decision: choice.decision,
        academic_session_id: sessionId,
        promoted_by: profile.id,
      });
      setActioned((prev) => new Set(prev).add(studentId));
      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, class_id: choice.toClassId } : s)));
      return true;
    } catch (e) {
      setErrors((prev) => ({ ...prev, [studentId]: getFriendlyErrorMessage(e, "Failed to save decision") }));
      return false;
    }
  }

  async function handleSave(studentId: string, choice: Choice) {
    setBusyId(studentId);
    await save(studentId, choice);
    setBusyId(null);
  }

  async function handleAcceptAll() {
    setBulkBusy(true);
    for (const r of pendingAcceptable) {
      if (r.suggested) await save(r.student.id, r.suggested);
    }
    setBulkBusy(false);
  }

  function setChoice(studentId: string, currentClassId: string | null, next: Partial<Choice>, fallback: Choice | null) {
    setOverrides((prev) => {
      const base = prev[studentId] ?? fallback ?? { decision: "promoted" as Decision, toClassId: currentClassId ?? "" };
      let merged = { ...base, ...next };
      // Switching to "repeat" means staying in the same class.
      if (next.decision === "repeated" && currentClassId) merged = { ...merged, toClassId: currentClassId };
      if (next.decision === "promoted" && base.decision === "repeated") {
        const candidate = fallback && fallback.decision === "promoted" ? fallback.toClassId : "";
        merged = { ...merged, toClassId: next.toClassId ?? candidate };
      }
      return { ...prev, [studentId]: merged };
    });
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Promotion</h1>
        <p className="font-ui text-sm text-forest-300 mt-1">
          Each child's suggested outcome is worked out from their daily-log score this term. Accept it, or change it
          before saving.
        </p>
      </div>

      {loadError && <p className="font-ui text-sm text-error">{loadError}</p>}

      {!loading && !sessionId && (
        <p className="font-ui text-sm text-warning">
          No current academic session is set. Set one under Terms before promoting children.
        </p>
      )}

      {!loading && term && (
        <p className={`font-ui text-xs ${termOver ? "text-forest-300" : "text-warning"}`}>
          {termOver
            ? `Term ${term.termNumber} has ended.`
            : `Term ${term.termNumber} is still running${term.endDate ? ` (ends ${term.endDate})` : ""}. These suggestions are provisional until it ends.`}
          {term.termNumber !== 3 && " Promotion is normally done at the end of Term 3."}
        </p>
      )}

      {!loading && students.length === 0 && (
        <p className="font-ui text-sm text-forest-300">No children yet. Add them under Children first.</p>
      )}

      {pendingAcceptable.length > 0 && (
        <button
          onClick={handleAcceptAll}
          disabled={bulkBusy || !sessionId}
          className="w-full py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
        >
          {bulkBusy ? "Saving..." : `Accept all ${pendingAcceptable.length} suggestion${pendingAcceptable.length === 1 ? "" : "s"}`}
        </button>
      )}

      <div className="space-y-3">
        {rows.map(({ student, currentClass, suggestion, suggested, choice }) => {
          const done = actioned.has(student.id);
          const score = scores[student.id];
          const overridden = !!overrides[student.id];
          const targetOptions =
            choice?.decision === "repeated" && currentClass ? [currentClass] : classes.filter((c) => c.id !== currentClass?.id);
          return (
            <div key={student.id} className="bg-forest-900 rounded-lg p-4 space-y-3" data-testid={`promo-${student.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-ui text-sm text-forest-100 truncate">{student.full_name}</p>
                  <p className="font-ui text-xs text-forest-300">{currentClass?.name ?? "No class"}</p>
                </div>
                <div className="text-right shrink-0">
                  {score !== undefined ? (
                    <p className={`font-ui text-lg font-semibold ${scoreColor(score)}`}>{score}/100</p>
                  ) : (
                    <p className="font-ui text-xs text-forest-300">No score</p>
                  )}
                  {done && (
                    <span className="font-ui text-[10px] bg-forest-500 text-forest-950 rounded-full px-2 py-0.5">
                      Actioned
                    </span>
                  )}
                </div>
              </div>

              <p className="font-ui text-xs text-forest-300">{suggestion.reason}</p>

              {!done && (
                <>
                  <div className="flex gap-2">
                    {(["promoted", "repeated"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setChoice(student.id, student.class_id, { decision: d }, suggested)}
                        className={`flex-1 py-2 rounded font-ui text-sm ${
                          choice?.decision === d ? "bg-forest-500 text-forest-950 font-semibold" : "bg-forest-800 text-forest-300"
                        }`}
                      >
                        {d === "promoted" ? "Promote" : "Repeat"}
                      </button>
                    ))}
                  </div>
                  <select
                    value={choice?.toClassId ?? ""}
                    onChange={(e) => setChoice(student.id, student.class_id, { toClassId: e.target.value }, suggested)}
                    aria-label={`Class for ${student.full_name}`}
                    className="w-full p-2 rounded bg-forest-950 border border-forest-700 text-forest-100 font-ui text-sm"
                  >
                    <option value="">Choose a class</option>
                    {targetOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {overridden && <p className="font-ui text-[11px] text-warning">You changed the suggestion.</p>}
                  <button
                    onClick={() => choice && choice.toClassId && handleSave(student.id, choice)}
                    disabled={!choice || !choice.toClassId || busyId === student.id || bulkBusy || !sessionId}
                    className="w-full py-2 rounded bg-forest-700 text-forest-100 font-ui text-sm disabled:opacity-50"
                  >
                    {busyId === student.id ? "Saving..." : overridden ? "Save my decision" : "Accept suggestion"}
                  </button>
                </>
              )}
              {errors[student.id] && <p className="font-ui text-xs text-error">{errors[student.id]}</p>}
            </div>
          );
        })}
      </div>
      <p className="font-ui text-[11px] text-forest-300/70">Pass mark: {PASS_MARK} out of 100.</p>
    </div>
  );
}
