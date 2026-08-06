import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchMyClass, fetchClassStudents, type MyClass, type ClassStudent } from "../features/attendance/api";
import {
  fetchAssignableQuizzes,
  fetchClassWork,
  createClassWork,
  type AssignableQuiz,
  type ClassWorkItem,
} from "../features/classwork/api";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClassTeacherAssignWork() {
  const { profile } = useAuth();
  const [myClass, setMyClass] = useState<MyClass | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [assignableQuizzes, setAssignableQuizzes] = useState<AssignableQuiz[]>([]);
  const [assignedWork, setAssignedWork] = useState<ClassWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [targetMode, setTargetMode] = useState<"whole_class" | "specific">("whole_class");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  async function loadAll() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const cls = await fetchMyClass(profile.id);
      setMyClass(cls);
      if (cls) {
        const [stu, quizzes, work] = await Promise.all([
          fetchClassStudents(cls.id),
          fetchAssignableQuizzes(cls.id),
          fetchClassWork(cls.id),
        ]);
        setStudents(stu);
        setAssignableQuizzes(quizzes);
        setAssignedWork(work);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assign work");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  }

  async function handleAssign() {
    if (!myClass || !profile?.school_id || !selectedQuizId) return;
    if (targetMode === "specific" && selectedStudentIds.length === 0) {
      setError("Select at least one student, or switch to Whole Class.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await createClassWork(
        profile.school_id,
        myClass.id,
        selectedQuizId,
        dueDate || null,
        targetMode === "specific" ? selectedStudentIds : null,
        profile.id
      );
      setSuccessMessage("Work assigned.");
      setSelectedQuizId("");
      setSelectedStudentIds([]);
      setTargetMode("whole_class");
      const work = await fetchClassWork(myClass.id);
      setAssignedWork(work);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign work");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  if (!myClass) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl text-forest-100">Assign Work</h1>
        <p className="font-ui text-sm text-forest-300 mt-2">
          You're not currently assigned to a class. Contact your School Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Assign Work</h1>
        <p className="font-ui text-xs text-forest-300">{myClass.name}</p>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {successMessage && <p className="font-ui text-sm text-forest-300">{successMessage}</p>}

      {assignableQuizzes.length === 0 ? (
        <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
          No ready quizzes yet -- generate one from a lesson under the Lessons tab first.
        </p>
      ) : (
        <div className="bg-forest-900 rounded-lg p-4 space-y-3">
          <h2 className="font-ui text-sm font-semibold text-forest-100">Assign a quiz</h2>

          <select
            value={selectedQuizId}
            onChange={(e) => setSelectedQuizId(e.target.value)}
            className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
          >
            <option value="">Select quiz</option>
            {assignableQuizzes.map((q) => (
              <option key={q.quiz_id} value={q.quiz_id}>
                {q.lesson_title} ({q.subject_name}) - {q.difficulty} - {q.question_count} questions
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="font-ui text-xs text-forest-300">Due date:</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTargetMode("whole_class")}
              className={`px-3 py-1.5 rounded font-ui text-xs ${
                targetMode === "whole_class"
                  ? "bg-forest-500 text-forest-950 font-semibold"
                  : "bg-forest-700 text-forest-100"
              }`}
            >
              Whole Class
            </button>
            <button
              onClick={() => setTargetMode("specific")}
              className={`px-3 py-1.5 rounded font-ui text-xs ${
                targetMode === "specific"
                  ? "bg-forest-500 text-forest-950 font-semibold"
                  : "bg-forest-700 text-forest-100"
              }`}
            >
              Specific Students
            </button>
          </div>

          {targetMode === "specific" && (
            <div className="flex flex-wrap gap-2">
              {students.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-1.5 bg-forest-700/40 rounded px-2 py-1 font-ui text-xs text-forest-100 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                  />
                  {s.full_name}
                </label>
              ))}
            </div>
          )}

          <button
            onClick={handleAssign}
            disabled={saving || !selectedQuizId}
            className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Assigning..." : "Assign Work"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Assigned work</h2>
        {assignedWork.length === 0 && (
          <p className="font-ui text-sm text-forest-300">No work assigned yet.</p>
        )}
        {assignedWork.map((w) => (
          <div key={w.id} className="bg-forest-900 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs px-2 py-0.5 rounded bg-forest-700 text-forest-100">
                {w.subject_name}
              </span>
              {w.due_date && <span className="font-ui text-xs text-forest-300">Due {w.due_date}</span>}
            </div>
            <p className="font-display text-forest-100 mt-1">{w.lesson_title}</p>
            <p className="font-ui text-xs text-forest-300 mt-1">
              {w.assignee_count === 0 ? "Whole class" : `${w.assignee_count} student(s)`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
