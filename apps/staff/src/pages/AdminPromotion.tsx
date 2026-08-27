import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchClasses, type SchoolClass } from "../features/classes/api";
import { fetchStudents, type Student } from "../features/students/api";
import {
  fetchCurrentSessionId,
  fetchPromotionsForSession,
  suggestNextClasses,
  fetchSubjects,
  fetchStudentAttendance,
  fetchStudentFees,
  fetchCarryovers,
  promoteStudent,
  addCarryover,
  removeCarryover,
  type ClassSuggestion,
  type AttendanceRecord,
  type FeeRecord,
} from "../features/promotion/api";

export default function AdminPromotion() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"promoted" | "repeated">("promoted");
  const [toClassId, setToClassId] = useState("");
  const [suggestions, setSuggestions] = useState<ClassSuggestion[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [existingCarryovers, setExistingCarryovers] = useState<{ id: string; subject: { name: string } | null }[]>([]);
  const [carryoverSubjectId, setCarryoverSubjectId] = useState("");
  const [rowLoading, setRowLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowSuccess, setRowSuccess] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [cls, sess, subs] = await Promise.all([
          fetchClasses(schoolId),
          fetchCurrentSessionId(schoolId),
          fetchSubjects(),
        ]);
        setClasses(cls);
        setSessionId(sess);
        setSubjects(subs);
        if (sess) {
          const actionedIds = await fetchPromotionsForSession(schoolId, sess);
          setActioned(actionedIds);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedClassId) {
      setStudents([]);
      return;
    }
    fetchStudents(schoolId).then((all) => setStudents(all.filter((s) => s.class_id === selectedClassId)));
  }, [schoolId, selectedClassId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;

  function resetRowState() {
    setDecision("promoted");
    setRowError(null);
    setRowSuccess(false);
    setCarryoverSubjectId("");
    setSuggestions([]);
    setAttendance([]);
    setFees([]);
    setExistingCarryovers([]);
  }

  async function handleExpand(student: Student) {
    if (expandedId === student.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(student.id);
    resetRowState();
    setRowLoading(true);
    try {
      const [sugg, att, fee, carry] = await Promise.all([
        schoolId ? suggestNextClasses(schoolId, selectedClass?.level ?? null) : Promise.resolve([]),
        fetchStudentAttendance(student.id),
        fetchStudentFees(student.id),
        sessionId ? fetchCarryovers(student.id, sessionId) : Promise.resolve([]),
      ]);
      setSuggestions(sugg);
      setToClassId(sugg[0]?.id ?? selectedClassId);
      setAttendance(att);
      setFees(fee);
      setExistingCarryovers(carry);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Failed to load student details");
    } finally {
      setRowLoading(false);
    }
  }

  function handleDecisionChange(next: "promoted" | "repeated") {
    setDecision(next);
    setToClassId(next === "repeated" ? selectedClassId : suggestions[0]?.id ?? selectedClassId);
  }

  async function handleSubmit(student: Student) {
    if (!schoolId || !sessionId || !toClassId || !profile?.id) return;
    setSaving(true);
    setRowError(null);
    try {
      await promoteStudent({
        school_id: schoolId,
        student_id: student.id,
        from_class_id: selectedClassId,
        to_class_id: toClassId,
        decision,
        academic_session_id: sessionId,
        promoted_by: profile.id,
      });
      setActioned((prev) => new Set(prev).add(student.id));
      setRowSuccess(true);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Failed to save decision");
    } finally {
      setSaving(false);
    }
  }

  // Carryover always attaches to the class this promotion round is FOR
  // (selectedClassId) -- the student's old/current class, where the
  // carried-over subject's classes actually happen. Not student.class_id,
  // which only changes in the database once the decision is saved, kept
  // out of local state deliberately to avoid ambiguity mid-workflow.
  async function handleAddCarryover(student: Student) {
    if (!schoolId || !sessionId || !carryoverSubjectId || !profile?.id) return;
    setSaving(true);
    setRowError(null);
    try {
      await addCarryover(
        {
          school_id: schoolId,
          student_id: student.id,
          subject_id: carryoverSubjectId,
          carryover_class_id: selectedClassId,
          academic_session_id: sessionId,
        },
        profile.id
      );
      const carry = await fetchCarryovers(student.id, sessionId);
      setExistingCarryovers(carry);
      setCarryoverSubjectId("");
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Failed to add carryover");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveCarryover(carryoverId: string) {
    if (!schoolId || !profile?.id) return;
    try {
      await removeCarryover(carryoverId, schoolId, profile.id);
      setExistingCarryovers((prev) => prev.filter((c) => c.id !== carryoverId));
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Failed to remove carryover");
    }
  }

  const attendanceCounts = attendance.reduce(
    (acc, a) => {
      acc[a.status] += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0 }
  );
  const totalDue = fees.reduce((sum, f) => sum + f.amount_due, 0);
  const totalPaid = fees.reduce((sum, f) => sum + f.amount_paid, 0);
  const outstanding = totalDue - totalPaid;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Promotion</h1>
        <p className="font-ui text-sm text-forest-300 mt-1">
          Pick a class, then review each student before promoting, repeating, or adding a subject carryover.
        </p>
      </div>

      {loadError && <p className="font-ui text-sm text-error">{loadError}</p>}

      <select
        value={selectedClassId}
        onChange={(e) => {
          setSelectedClassId(e.target.value);
          setExpandedId(null);
        }}
        disabled={loading}
        className="w-full p-2 rounded bg-forest-900 border border-forest-700 text-forest-100 font-ui text-sm"
      >
        <option value="">{loading ? "Loading classes..." : "Select a class"}</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {!sessionId && !loading && (
        <p className="font-ui text-sm text-warning">
          No current academic session is set for this school -- set one under Sessions before promoting students.
        </p>
      )}

      {selectedClassId && students.length === 0 && (
        <p className="font-ui text-sm text-forest-300">No students in this class.</p>
      )}

      <div className="space-y-2">
        {students.map((student) => {
          const isExpanded = expandedId === student.id;
          const isActioned = actioned.has(student.id);
          return (
            <div key={student.id} className="bg-forest-900 rounded-lg overflow-hidden">
              <button
                onClick={() => handleExpand(student)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-ui text-sm text-forest-100">{student.full_name}</span>
                  {isActioned && (
                    <span className="font-ui text-[10px] bg-forest-500 text-forest-950 rounded-full px-2 py-0.5">
                      Actioned
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp size={18} className="text-forest-300" />
                ) : (
                  <ChevronDown size={18} className="text-forest-300" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-forest-800 pt-4">
                  {rowLoading ? (
                    <p className="font-ui text-sm text-forest-300">Loading...</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-forest-950 rounded p-3">
                          <p className="font-ui text-xs text-forest-300 mb-1">
                            Attendance (last {attendance.length})
                          </p>
                          <p className="font-ui text-sm text-forest-100">
                            {attendanceCounts.present} present, {attendanceCounts.absent} absent,{" "}
                            {attendanceCounts.late} late
                          </p>
                        </div>
                        <div className="bg-forest-950 rounded p-3">
                          <p className="font-ui text-xs text-forest-300 mb-1">Fees</p>
                          <p className={`font-ui text-sm ${outstanding > 0 ? "text-warning" : "text-forest-100"}`}>
                            {outstanding > 0 ? `\u20a6${outstanding.toLocaleString()} outstanding` : "Fully paid"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="font-ui text-xs text-forest-300">Decision</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDecisionChange("promoted")}
                            className={`flex-1 py-2 rounded font-ui text-sm ${
                              decision === "promoted"
                                ? "bg-forest-500 text-forest-950 font-semibold"
                                : "bg-forest-800 text-forest-300"
                            }`}
                          >
                            Promote
                          </button>
                          <button
                            onClick={() => handleDecisionChange("repeated")}
                            className={`flex-1 py-2 rounded font-ui text-sm ${
                              decision === "repeated"
                                ? "bg-forest-500 text-forest-950 font-semibold"
                                : "bg-forest-800 text-forest-300"
                            }`}
                          >
                            Repeat
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="font-ui text-xs text-forest-300">
                          {decision === "promoted" ? "Promote to" : "Repeat in"}
                        </label>
                        <select
                          value={toClassId}
                          onChange={(e) => setToClassId(e.target.value)}
                          className="mt-1 w-full p-2 rounded bg-forest-950 border border-forest-700 text-forest-100 font-ui text-sm"
                        >
                          {decision === "promoted" &&
                            suggestions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          {decision === "repeated" && (
                            <option value={selectedClassId}>{selectedClass?.name}</option>
                          )}
                        </select>
                      </div>

                      {rowError && <p className="font-ui text-xs text-error">{rowError}</p>}
                      {rowSuccess && <p className="font-ui text-xs text-forest-300">Decision saved.</p>}

                      <button
                        onClick={() => handleSubmit(student)}
                        disabled={saving || !toClassId}
                        className="w-full py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Decision"}
                      </button>

                      {decision === "promoted" && (
                        <div className="space-y-2 pt-2 border-t border-forest-800">
                          <p className="font-ui text-xs text-forest-300">
                            Subject Carryover -- student attends this subject with their old class (
                            {selectedClass?.name})
                          </p>

                          {existingCarryovers.length > 0 && (
                            <ul className="space-y-1">
                              {existingCarryovers.map((c) => (
                                <li
                                  key={c.id}
                                  className="flex items-center justify-between bg-forest-950 rounded px-3 py-2"
                                >
                                  <span className="font-ui text-sm text-forest-100">
                                    {c.subject?.name ?? "Unknown subject"}
                                  </span>
                                  <button onClick={() => handleRemoveCarryover(c.id)} aria-label="Remove carryover">
                                    <X size={14} className="text-forest-300" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="flex gap-2">
                            <select
                              value={carryoverSubjectId}
                              onChange={(e) => setCarryoverSubjectId(e.target.value)}
                              className="flex-1 p-2 rounded bg-forest-950 border border-forest-700 text-forest-100 font-ui text-sm"
                            >
                              <option value="">Select subject</option>
                              {subjects
                                .filter((s) => !existingCarryovers.some((c) => c.subject?.name === s.name))
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleAddCarryover(student)}
                              disabled={!carryoverSubjectId || saving}
                              className="px-4 py-2 rounded bg-forest-700 text-forest-100 font-ui text-sm disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
