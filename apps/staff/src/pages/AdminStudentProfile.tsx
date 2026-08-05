import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { User } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchStudentById, getSignedPhotoUrl, type Student } from "../features/students/api";
import { fetchClasses, type SchoolClass } from "../features/classes/api";
import {
  fetchStudentAttendance,
  fetchStudentFees,
  fetchCurrentSessionId,
  suggestNextClasses,
  fetchSubjects,
  promoteStudent,
  addCarryover,
  fetchCarryovers,
  removeCarryover,
  type AttendanceRecord,
  type FeeRecord,
  type ClassSuggestion,
} from "../features/promotion/api";

const STATUS_LABELS: Record<string, string> = { present: "Present", absent: "Absent", late: "Late" };

export default function AdminStudentProfile() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [student, setStudent] = useState<Student | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [currentClass, setCurrentClass] = useState<SchoolClass | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ClassSuggestion[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [carryovers, setCarryovers] = useState<{ id: string; subject: { name: string } | null }[]>([]);

  const [decision, setDecision] = useState<"promoted" | "repeated">("promoted");
  const [targetClassId, setTargetClassId] = useState("");
  const [selectedCarryoverSubjects, setSelectedCarryoverSubjects] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadAll() {
    if (!id || !schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const [stu, allClasses, att, feeRecords, currentSessionId, subs] = await Promise.all([
        fetchStudentById(id),
        fetchClasses(schoolId),
        fetchStudentAttendance(id),
        fetchStudentFees(id),
        fetchCurrentSessionId(schoolId),
        fetchSubjects(),
      ]);
      setStudent(stu);
      setAttendance(att);
      setFees(feeRecords);
      setSessionId(currentSessionId);
      setSubjects(subs);

      const cls = allClasses.find((c) => c.id === stu?.class_id) ?? null;
      setCurrentClass(cls);

      if (stu?.photo_url) {
        const url = await getSignedPhotoUrl(stu.photo_url);
        setPhotoUrl(url);
      }

      const sugg = await suggestNextClasses(schoolId, cls?.level ?? null);
      setSuggestions(sugg);
      setTargetClassId(sugg[0]?.id ?? "");

      if (currentSessionId) {
        const co = await fetchCarryovers(id, currentSessionId);
        setCarryovers(co);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load student profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, schoolId]);

  function toggleCarryoverSubject(subjectId: string) {
    setSelectedCarryoverSubjects((prev) =>
      prev.includes(subjectId) ? prev.filter((s) => s !== subjectId) : [...prev, subjectId]
    );
  }

  async function handleConfirmPromotion() {
    if (!student || !schoolId || !sessionId || !profile) return;
    const toClassId = decision === "repeated" ? student.class_id : targetClassId;
    if (!toClassId) {
      setError("Select a target class first.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await promoteStudent({
        school_id: schoolId,
        student_id: student.id,
        from_class_id: student.class_id,
        to_class_id: toClassId,
        decision,
        academic_session_id: sessionId,
        promoted_by: profile.id,
      });

      if (decision === "promoted" && student.class_id) {
        for (const subjectId of selectedCarryoverSubjects) {
          await addCarryover({
            school_id: schoolId,
            student_id: student.id,
            subject_id: subjectId,
            carryover_class_id: student.class_id,
            academic_session_id: sessionId,
          }, profile.id);
        }
      }

      setSuccess(decision === "promoted" ? "Student promoted successfully." : "Student marked to repeat.");
      setSelectedCarryoverSubjects([]);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save promotion");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveCarryover(carryoverId: string) {
    try {
      await removeCarryover(carryoverId, schoolId!, profile!.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove carryover");
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;
  if (!student) return <div className="p-6 font-ui text-forest-100">Student not found.</div>;

  return (
    <div className="p-6 space-y-6">
      <Link to="/admin/students" className="inline-block px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs hover:bg-forest-700/70">
        ← Back to Students
      </Link>

      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt={student.full_name} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-forest-700 flex items-center justify-center">
            <User size={28} className="text-forest-300" />
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl text-forest-100">{student.full_name}</h1>
          <p className="font-ui text-xs text-forest-300">
            ID: {student.unique_student_id} · Class: {currentClass?.name ?? "Unassigned"}
          </p>
        </div>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {success && <p className="text-forest-500 font-ui text-sm">{success}</p>}

      {/* Promotion */}
      <div className="bg-forest-900 rounded-lg p-4 space-y-4">
        <h2 className="font-display text-lg text-forest-100">Promotion</h2>

        {!sessionId && (
          <p className="font-ui text-xs text-forest-300">
            No current academic session set — set one under Sessions & Terms before promoting.
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setDecision("promoted")}
            className={`px-3 py-1.5 rounded font-ui text-xs font-semibold ${
              decision === "promoted" ? "bg-forest-500 text-forest-950" : "bg-forest-700 text-forest-100"
            }`}
          >
            Promote
          </button>
          <button
            onClick={() => setDecision("repeated")}
            className={`px-3 py-1.5 rounded font-ui text-xs font-semibold ${
              decision === "repeated" ? "bg-forest-500 text-forest-950" : "bg-forest-700 text-forest-100"
            }`}
          >
            Repeat
          </button>
        </div>

        {decision === "promoted" && (
          <div className="flex items-center gap-2">
            <span className="font-ui text-xs text-forest-300">New class:</span>
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
            >
              <option value="">Select class...</option>
              {suggestions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {decision === "repeated" && (
          <p className="font-ui text-xs text-forest-300">
            Student will stay in {currentClass?.name ?? "their current class"}.
          </p>
        )}

        {decision === "promoted" && (
          <div className="space-y-1.5">
            <span className="font-ui text-xs text-forest-300">
              Carry over subjects to {currentClass?.name ?? "old class"} (optional):
            </span>
            {subjects.length === 0 ? (
              <p className="font-ui text-xs text-forest-300/60">
                No subjects available yet — waiting on Curriculum management.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-1.5 bg-forest-700/40 rounded px-2 py-1 font-ui text-xs text-forest-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCarryoverSubjects.includes(s.id)}
                      onChange={() => toggleCarryoverSubject(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleConfirmPromotion}
          disabled={saving || !sessionId}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : "Confirm"}
        </button>

        {carryovers.length > 0 && (
          <div className="pt-2 space-y-1">
            <span className="font-ui text-xs text-forest-300">Active carryovers this session:</span>
            {carryovers.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-forest-700/40 rounded px-2 py-1">
                <span className="font-ui text-xs text-forest-100">{c.subject?.name ?? "Unknown subject"}</span>
                <button
                  onClick={() => handleRemoveCarryover(c.id)}
                  className="font-ui text-[11px] text-error"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance history */}
      <div className="bg-forest-900 rounded-lg p-4 space-y-2">
        <h2 className="font-display text-lg text-forest-100">Attendance History</h2>
        {attendance.length === 0 ? (
          <p className="font-ui text-xs text-forest-300">No attendance records yet.</p>
        ) : (
          <div className="space-y-1">
            {attendance.map((a) => (
              <div key={a.id} className="flex justify-between font-ui text-xs text-forest-100">
                <span>{a.date}</span>
                <span
                  className={
                    a.status === "present"
                      ? "text-forest-500"
                      : a.status === "late"
                      ? "text-warning"
                      : "text-error"
                  }
                >
                  {STATUS_LABELS[a.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fees */}
      <div className="bg-forest-900 rounded-lg p-4 space-y-2">
        <h2 className="font-display text-lg text-forest-100">Fee Status</h2>
        {fees.length === 0 ? (
          <p className="font-ui text-xs text-forest-300">No fees recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {fees.map((f) => (
              <div key={f.id} className="flex justify-between font-ui text-xs text-forest-100">
                <span>{f.fee_type?.name ?? "Unknown fee"}</span>
                <span className={f.is_paid ? "text-forest-500" : "text-error"}>
                  ₦{f.amount_paid.toLocaleString()} / ₦{f.amount_due.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
