import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchClasses,
  fetchClassTeacherOptions,
  createClass,
  assignClassTeacher,
  assignClassLevel,
  renameClass,
  CLASS_LEVELS,
  type SchoolClass,
  type ClassTeacherOption,
} from "../features/classes/api";

export default function AdminClasses() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<ClassTeacherOption[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const schoolId = profile?.school_id;

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const [cls, teachers] = await Promise.all([
        fetchClasses(schoolId),
        fetchClassTeacherOptions(schoolId),
      ]);
      setClasses(cls);
      setTeacherOptions(teachers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function handleCreateClass() {
    if (!schoolId || !newClassName.trim()) return;
    try {
      await createClass(schoolId, newClassName.trim(), newLevel || null, profile!.id);
      setNewClassName("");
      setNewLevel("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create class");
    }
  }

  async function handleAssignTeacher(classId: string, teacherId: string) {
    try {
      await assignClassTeacher(classId, teacherId === "" ? null : teacherId, schoolId!, profile!.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign class teacher");
    }
  }

  async function handleAssignLevel(classId: string, level: string) {
    try {
      await assignClassLevel(classId, level === "" ? null : level, schoolId!, profile!.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set class level");
    }
  }

  function startEditing(cls: SchoolClass) {
    setEditingId(cls.id);
    setEditingName(cls.name);
  }

  async function handleSaveRename(classId: string) {
    if (!editingName.trim()) return;
    try {
      await renameClass(classId, editingName.trim(), schoolId!, profile!.id);
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename class");
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Classes</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      {teacherOptions.length === 0 && (
        <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
          No class teachers exist yet — add staff under Staff Management first, then come back here to assign them.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder='New class, e.g. "JSS 1A"'
          value={newClassName}
          onChange={(e) => setNewClassName(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
        />
        <select
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
        >
          <option value="">Standard Level (optional)</option>
          {CLASS_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleCreateClass}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold"
        >
          Add Class
        </button>
      </div>
      <p className="font-ui text-xs text-forest-300 -mt-4">
        Standard Level determines which curriculum this class sees.
      </p>

      <div className="space-y-3">
        {classes.length === 0 && (
          <p className="text-forest-300 font-ui text-sm">No classes yet — create one above.</p>
        )}

        {classes.map((cls) => (
          <div
            key={cls.id}
            className="bg-forest-900 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            {editingId === cls.id ? (
              <div className="flex gap-2 flex-1">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="p-2 rounded bg-forest-700 text-forest-100 font-ui flex-1"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveRename(cls.id)}
                  className="px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => startEditing(cls)}
                className="font-display text-lg text-forest-100 text-left hover:underline"
              >
                {cls.name}
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="font-ui text-xs text-forest-300">Level:</span>
              <select
                value={cls.level ?? ""}
                onChange={(e) => handleAssignLevel(cls.id, e.target.value)}
                className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
              >
                <option value="">Not set</option>
                {CLASS_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-ui text-xs text-forest-300">Class Teacher:</span>
              <select
                value={cls.class_teacher_id ?? ""}
                onChange={(e) => handleAssignTeacher(cls.id, e.target.value)}
                className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
              >
                <option value="">Unassigned</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
