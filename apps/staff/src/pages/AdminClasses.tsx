import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchClasses,
  fetchClassTeacherOptions,
  createClass,
  assignClassTeacher,
  assignClassLevel,
  renameClass,
  deleteClass,
  CLASS_LEVELS,
  type SchoolClass,
  type ClassTeacherOption,
} from "../features/classes/api";
import {
  fetchClassSubjects,
  findOrCreateSubject,
  assignSubjectToClass,
  removeSubjectFromClass,
  type ClassSubject,
} from "../features/subjects/api";

export default function AdminClasses() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<ClassTeacherOption[]>([]);
  const [classSubjects, setClassSubjects] = useState<Record<string, ClassSubject[]>>({});
  const [newSubjectInputs, setNewSubjectInputs] = useState<Record<string, string>>({});
  const [subjectSaving, setSubjectSaving] = useState<Record<string, boolean>>({});
  const [newClassName, setNewClassName] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      const subjectEntries = await Promise.all(
        cls.map(async (c) => [c.id, await fetchClassSubjects(c.id)] as const)
      );
      setClassSubjects(Object.fromEntries(subjectEntries));
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

  async function handleDeleteClass(cls: SchoolClass) {
    if (!schoolId) return;
    if (!window.confirm(`Delete "${cls.name}"? This can't be undone.`)) return;
    setDeletingId(cls.id);
    setError(null);
    try {
      await deleteClass(cls.id, schoolId, profile!.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete class");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddSubject(classId: string) {
    const name = (newSubjectInputs[classId] ?? "").trim();
    if (!name || !schoolId) return;
    setSubjectSaving((prev) => ({ ...prev, [classId]: true }));
    setError(null);
    try {
      const subject = await findOrCreateSubject(name);
      const alreadyAssigned = (classSubjects[classId] ?? []).some((cs) => cs.subject_id === subject.id);
      if (alreadyAssigned) {
        setError(`${subject.name} is already assigned to this class.`);
        return;
      }
      await assignSubjectToClass(classId, subject.id, schoolId, profile!.id);
      setNewSubjectInputs((prev) => ({ ...prev, [classId]: "" }));
      const updated = await fetchClassSubjects(classId);
      setClassSubjects((prev) => ({ ...prev, [classId]: updated }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add subject");
    } finally {
      setSubjectSaving((prev) => ({ ...prev, [classId]: false }));
    }
  }

  async function handleRemoveSubject(classSubject: ClassSubject) {
    if (!schoolId) return;
    try {
      await removeSubjectFromClass(
        classSubject.id,
        classSubject.class_id,
        classSubject.subject_id,
        schoolId,
        profile!.id
      );
      const updated = await fetchClassSubjects(classSubject.class_id);
      setClassSubjects((prev) => ({ ...prev, [classSubject.class_id]: updated }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove subject");
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
          <div key={cls.id} className="bg-forest-900 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

              <button
                onClick={() => handleDeleteClass(cls)}
                disabled={deletingId === cls.id}
                className="px-3 py-1.5 rounded text-xs font-ui text-error hover:bg-error/10 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {deletingId === cls.id ? "Deleting..." : "Delete"}
              </button>
            </div>

            <div className="border-t border-forest-700 pt-3">
              <span className="font-ui text-xs text-forest-300">Subjects offered:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {(classSubjects[cls.id] ?? []).map((cs) => (
                  <span
                    key={cs.id}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                  >
                    {cs.subject.name}
                    <button
                      onClick={() => handleRemoveSubject(cs)}
                      aria-label={`Remove ${cs.subject.name}`}
                      className="text-forest-300 hover:text-forest-100"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {(classSubjects[cls.id] ?? []).length === 0 && (
                  <span className="font-ui text-xs text-forest-300/60">No subjects assigned yet</span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder='Add subject, e.g. "Mathematics"'
                  value={newSubjectInputs[cls.id] ?? ""}
                  onChange={(e) =>
                    setNewSubjectInputs((prev) => ({ ...prev, [cls.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSubject(cls.id);
                  }}
                  className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm placeholder:text-forest-300/60 flex-1"
                />
                <button
                  onClick={() => handleAddSubject(cls.id)}
                  disabled={subjectSaving[cls.id] || !(newSubjectInputs[cls.id] ?? "").trim()}
                  className="px-3 py-2 rounded bg-forest-700 text-forest-100 font-ui text-sm disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
