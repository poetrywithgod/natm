import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchClasses, type SchoolClass } from "../features/classes/api";
import {
  fetchClassStudents,
  fetchAttendanceForDate,
  type ClassStudent,
  type AttendanceStatus,
} from "../features/attendance/api";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
};

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-forest-500 text-forest-950",
  absent: "bg-error text-forest-100",
  late: "bg-warning text-forest-950",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminAttendance() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    fetchClasses(schoolId)
      .then((cls) => {
        setClasses(cls);
        if (cls.length > 0) setSelectedClassId(cls[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load classes"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setStatusMap({});
      return;
    }
    setRowsLoading(true);
    setError(null);
    Promise.all([fetchClassStudents(selectedClassId), fetchAttendanceForDate(selectedClassId, date)])
      .then(([stu, records]) => {
        setStudents(stu);
        const map: Record<string, AttendanceStatus> = {};
        records.forEach((r) => {
          map[r.student_id] = r.status;
        });
        setStatusMap(map);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load attendance"))
      .finally(() => setRowsLoading(false));
  }, [selectedClassId, date]);

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Attendance</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      {classes.length === 0 ? (
        <p className="font-ui text-sm text-forest-300">No classes yet.</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayISO()}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
            />
          </div>

          {rowsLoading ? (
            <p className="font-ui text-sm text-forest-300">Loading...</p>
          ) : (
            <div className="space-y-2">
              {students.length === 0 && (
                <p className="font-ui text-sm text-forest-300">No students in this class.</p>
              )}
              {students.map((s) => {
                const status = statusMap[s.id];
                return (
                  <div
                    key={s.id}
                    className="bg-forest-900 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-display text-forest-100">{s.full_name}</p>
                      <p className="font-ui text-xs text-forest-300">{s.unique_student_id}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-ui font-semibold ${
                        status ? STATUS_COLORS[status] : "bg-forest-700 text-forest-300"
                      }`}
                    >
                      {status ? STATUS_LABELS[status] : "Not marked"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
