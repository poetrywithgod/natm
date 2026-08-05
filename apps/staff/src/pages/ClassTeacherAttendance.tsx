import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchCurrentTerm } from "../features/fees/api";
import {
  fetchMyClass,
  fetchClassStudents,
  fetchAttendanceForDate,
  saveAttendance,
  type MyClass,
  type ClassStudent,
  type AttendanceStatus,
} from "../features/attendance/api";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClassTeacherAttendance() {
  const { profile } = useAuth();
  const [myClass, setMyClass] = useState<MyClass | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [selections, setSelections] = useState<Record<string, AttendanceStatus>>({});
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const date = todayISO();

  async function loadAll() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const cls = await fetchMyClass(profile.id);
      setMyClass(cls);
      if (cls) {
        const stu = await fetchClassStudents(cls.id);
        setStudents(stu);

        const existing = await fetchAttendanceForDate(cls.id, date);
        if (existing.length > 0) {
          const map: Record<string, AttendanceStatus> = {};
          existing.forEach((r) => {
            map[r.student_id] = r.status;
          });
          setSelections(map);
          setAlreadySaved(true);
        } else {
          // Default everyone to Present — teacher only needs to change exceptions.
          const defaults: Record<string, AttendanceStatus> = {};
          stu.forEach((s) => {
            defaults[s.id] = "present";
          });
          setSelections(defaults);
          setAlreadySaved(false);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setSelections((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSave() {
    if (!myClass || !profile?.school_id) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const term = await fetchCurrentTerm(profile.school_id);
      if (!term) {
        setError("No current session/term is set for your school yet.");
        return;
      }
      const entries = students.map((s) => ({
        studentId: s.id,
        status: selections[s.id] ?? "present",
      }));
      await saveAttendance(myClass.id, term.id, date, profile.id, entries, profile.school_id!);
      setSuccessMessage("Attendance saved.");
      setAlreadySaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  if (!myClass) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl text-forest-100">Attendance</h1>
        <p className="font-ui text-sm text-forest-300 mt-2">
          You're not currently assigned to a class. Contact your School Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="font-display text-2xl text-forest-100">{myClass.name}</h1>
        <p className="font-ui text-xs text-forest-300">{date}</p>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {successMessage && <p className="font-ui text-sm text-forest-300">{successMessage}</p>}
      {alreadySaved && (
        <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
          Attendance already recorded for today — editable until the day ends.
        </p>
      )}

      <div className="space-y-2">
        {students.length === 0 && (
          <p className="font-ui text-sm text-forest-300">No students in this class yet.</p>
        )}

        {students.map((s) => (
          <div key={s.id} className="bg-forest-900 rounded-lg p-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-display text-forest-100">{s.full_name}</p>
              <p className="font-ui text-xs text-forest-300">{s.unique_student_id}</p>
            </div>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(s.id, opt.value)}
                  className={`px-2 py-1.5 rounded font-ui text-xs ${
                    selections[s.id] === opt.value
                      ? "bg-forest-500 text-forest-950 font-semibold"
                      : "bg-forest-700 text-forest-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {students.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded bg-forest-500 text-forest-950 font-ui font-semibold"
        >
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      )}
    </div>
  );
}
