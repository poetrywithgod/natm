import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchClasses, type SchoolClass } from "../features/classes/api";
import {
  DAYS,
  fetchPeriods,
  createPeriod,
  updatePeriod,
  deletePeriod,
  fetchTimetableEntries,
  upsertTimetableEntry,
  deleteTimetableEntry,
  fetchSubjects,
  fetchClassTeachers,
  type TimetablePeriod,
  type TimetableEntry,
} from "../features/timetable/api";

export default function AdminTimetable() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id;

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newPeriod, setNewPeriod] = useState({ label: "", start_time: "", end_time: "" });
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editingPeriod, setEditingPeriod] = useState({ label: "", start_time: "", end_time: "" });

  const [editingCell, setEditingCell] = useState<{ day: number; periodId: string } | null>(null);
  const [cellSubject, setCellSubject] = useState("");
  const [cellTeacher, setCellTeacher] = useState("");

  async function loadBase() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const [cls, per, subs, teach] = await Promise.all([
        fetchClasses(schoolId),
        fetchPeriods(schoolId),
        fetchSubjects(),
        fetchClassTeachers(schoolId),
      ]);
      setClasses(cls);
      setPeriods(per);
      setSubjects(subs);
      setTeachers(teach);
      if (!selectedClassId && cls.length > 0) setSelectedClassId(cls[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load timetable data");
    } finally {
      setLoading(false);
    }
  }

  async function loadEntries(classId: string) {
    try {
      const data = await fetchTimetableEntries(classId);
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load timetable entries");
    }
  }

  useEffect(() => {
    loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassId) loadEntries(selectedClassId);
  }, [selectedClassId]);

  async function handleAddPeriod() {
    if (!schoolId || !newPeriod.label.trim() || !newPeriod.start_time || !newPeriod.end_time) return;
    try {
      const nextNumber = periods.length > 0 ? Math.max(...periods.map((p) => p.period_number)) + 1 : 1;
      await createPeriod({
        school_id: schoolId,
        period_number: nextNumber,
        label: newPeriod.label.trim(),
        start_time: newPeriod.start_time,
        end_time: newPeriod.end_time,
      });
      setNewPeriod({ label: "", start_time: "", end_time: "" });
      await loadBase();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add period");
    }
  }

  function startEditingPeriod(p: TimetablePeriod) {
    setEditingPeriodId(p.id);
    setEditingPeriod({ label: p.label, start_time: p.start_time, end_time: p.end_time });
  }

  async function handleSavePeriod(id: string) {
    try {
      await updatePeriod(id, editingPeriod);
      setEditingPeriodId(null);
      await loadBase();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update period");
    }
  }

  async function handleDeletePeriod(id: string) {
    try {
      await deletePeriod(id);
      await loadBase();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete period");
    }
  }

  function getEntry(day: number, periodId: string) {
    return entries.find((e) => e.day_of_week === day && e.period_id === periodId);
  }

  function openCell(day: number, periodId: string) {
    const existing = getEntry(day, periodId);
    setEditingCell({ day, periodId });
    setCellSubject(existing?.subject_id ?? "");
    setCellTeacher(existing?.teacher_id ?? "");
  }

  async function handleSaveCell() {
    if (!editingCell || !schoolId || !selectedClassId || !cellSubject || !cellTeacher) return;
    try {
      await upsertTimetableEntry({
        school_id: schoolId,
        class_id: selectedClassId,
        day_of_week: editingCell.day,
        period_id: editingCell.periodId,
        subject_id: cellSubject,
        teacher_id: cellTeacher,
      });
      setEditingCell(null);
      await loadEntries(selectedClassId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save timetable slot");
    }
  }

  async function handleClearCell() {
    if (!editingCell) return;
    const existing = getEntry(editingCell.day, editingCell.periodId);
    if (!existing) {
      setEditingCell(null);
      return;
    }
    try {
      await deleteTimetableEntry(existing.id);
      setEditingCell(null);
      await loadEntries(selectedClassId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear timetable slot");
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Timetable</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      {/* Periods setup */}
      <div className="bg-forest-900 rounded-lg p-4 space-y-3">
        <h2 className="font-display text-lg text-forest-100">Periods</h2>

        {periods.length === 0 && (
          <p className="font-ui text-xs text-forest-300">
            No periods set up yet — add your school's daily period structure below.
          </p>
        )}

        <div className="space-y-2">
          {periods.map((p) => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 bg-forest-700/40 rounded p-2"
            >
              {editingPeriodId === p.id ? (
                <>
                  <input
                    type="text"
                    value={editingPeriod.label}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, label: e.target.value })}
                    className="p-1.5 rounded bg-forest-700 text-forest-100 font-ui text-sm flex-1"
                  />
                  <input
                    type="time"
                    value={editingPeriod.start_time}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, start_time: e.target.value })}
                    className="p-1.5 rounded bg-forest-700 text-forest-100 font-ui text-sm"
                  />
                  <input
                    type="time"
                    value={editingPeriod.end_time}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, end_time: e.target.value })}
                    className="p-1.5 rounded bg-forest-700 text-forest-100 font-ui text-sm"
                  />
                  <button
                    onClick={() => handleSavePeriod(p.id)}
                    className="px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingPeriodId(null)}
                    className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="font-ui text-sm text-forest-100 flex-1">
                    {p.period_number}. {p.label}
                  </span>
                  <span className="font-ui text-xs text-forest-300">
                    {p.start_time} – {p.end_time}
                  </span>
                  <button
                    onClick={() => startEditingPeriod(p)}
                    className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePeriod(p.id)}
                    className="px-3 py-1.5 rounded bg-error/20 text-error font-ui text-xs"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <input
            type="text"
            placeholder="Period label, e.g. Period 1"
            value={newPeriod.label}
            onChange={(e) => setNewPeriod({ ...newPeriod, label: e.target.value })}
            className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
          />
          <input
            type="time"
            value={newPeriod.start_time}
            onChange={(e) => setNewPeriod({ ...newPeriod, start_time: e.target.value })}
            className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
          />
          <input
            type="time"
            value={newPeriod.end_time}
            onChange={(e) => setNewPeriod({ ...newPeriod, end_time: e.target.value })}
            className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
          />
          <button
            onClick={handleAddPeriod}
            className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold"
          >
            Add Period
          </button>
        </div>
      </div>

      {/* Class selector */}
      <div className="flex items-center gap-2">
        <span className="font-ui text-sm text-forest-300">Class:</span>
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
      </div>

      {/* Grid */}
      {periods.length === 0 ? (
        <p className="font-ui text-sm text-forest-300">Add periods above to start building the timetable.</p>
      ) : !selectedClassId ? (
        <p className="font-ui text-sm text-forest-300">Create a class first under Classes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="font-ui text-xs text-forest-300 text-left p-2">Period</th>
                {DAYS.map((d) => (
                  <th key={d.value} className="font-ui text-xs text-forest-300 text-left p-2">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="font-ui text-xs text-forest-300 p-2 whitespace-nowrap">
                    {p.label}
                    <br />
                    {p.start_time}–{p.end_time}
                  </td>
                  {DAYS.map((d) => {
                    const entry = getEntry(d.value, p.id);
                    const isEditing =
                      editingCell?.day === d.value && editingCell?.periodId === p.id;
                    return (
                      <td key={d.value} className="p-1 align-top min-w-[160px]">
                        {isEditing ? (
                          <div className="bg-forest-700 rounded p-2 space-y-1.5">
                            <select
                              value={cellSubject}
                              onChange={(e) => setCellSubject(e.target.value)}
                              className="w-full p-1.5 rounded bg-forest-900 text-forest-100 font-ui text-xs"
                            >
                              <option value="">Subject...</option>
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={cellTeacher}
                              onChange={(e) => setCellTeacher(e.target.value)}
                              className="w-full p-1.5 rounded bg-forest-900 text-forest-100 font-ui text-xs"
                            >
                              <option value="">Teacher...</option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.full_name}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-1">
                              <button
                                onClick={handleSaveCell}
                                className="flex-1 px-2 py-1 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleClearCell}
                                className="px-2 py-1 rounded bg-error/20 text-error font-ui text-xs"
                              >
                                Clear
                              </button>
                              <button
                                onClick={() => setEditingCell(null)}
                                className="px-2 py-1 rounded bg-forest-900 text-forest-100 font-ui text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openCell(d.value, p.id)}
                            className="w-full h-full min-h-[52px] rounded p-2 text-left bg-forest-900 hover:bg-forest-700/60 transition"
                          >
                            {entry ? (
                              <>
                                <div className="font-ui text-xs text-forest-100 font-semibold">
                                  {entry.subject?.name}
                                </div>
                                <div className="font-ui text-[11px] text-forest-300">
                                  {entry.teacher?.full_name}
                                </div>
                              </>
                            ) : (
                              <span className="font-ui text-xs text-forest-300/50">+ Add</span>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
