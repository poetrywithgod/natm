import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, User } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchStudents,
  fetchClassOptions,
  createStudent,
  assignStudentClass,
  renameStudent,
  uploadStudentPhoto,
  getSignedPhotoUrl,
  type Student,
  type ClassOption,
} from "../features/students/api";

export default function AdminStudents() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const schoolId = profile?.school_id;

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const [stu, cls] = await Promise.all([fetchStudents(schoolId), fetchClassOptions(schoolId)]);
      setStudents(stu);
      setClassOptions(cls);

      const urls: Record<string, string> = {};
      await Promise.all(
        stu
          .filter((s) => s.photo_url)
          .map(async (s) => {
            const url = await getSignedPhotoUrl(s.photo_url!);
            if (url) urls[s.id] = url;
          })
      );
      setPhotoUrls(urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function handleCreateStudent() {
    if (!schoolId || !newName.trim()) return;
    try {
      await createStudent(schoolId, newName.trim(), newClassId || null);
      setNewName("");
      setNewClassId("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create student");
    }
  }

  async function handleAssignClass(studentId: string, classId: string) {
    try {
      await assignStudentClass(studentId, classId === "" ? null : classId);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign class");
    }
  }

  function startEditing(student: Student) {
    setEditingId(student.id);
    setEditingName(student.full_name);
  }

  async function handleSaveRename(studentId: string) {
    if (!editingName.trim()) return;
    try {
      await renameStudent(studentId, editingName.trim());
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename student");
    }
  }

  async function handlePhotoChange(studentId: string, file: File | undefined) {
    if (!schoolId || !file) return;
    setUploadingId(studentId);
    try {
      await uploadStudentPhoto(schoolId, studentId, file);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload photo");
    } finally {
      setUploadingId(null);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Students</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="bg-forest-900 rounded-lg p-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Full name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
        />
        <select
          value={newClassId}
          onChange={(e) => setNewClassId(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
        >
          <option value="">No class</option>
          {classOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleCreateStudent}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold whitespace-nowrap"
        >
          Add Student
        </button>
      </div>
      <p className="font-ui text-xs text-forest-300 -mt-4">
        Student ID is generated automatically once added.
      </p>

      <div className="space-y-3">
        {students.length === 0 && (
          <p className="text-forest-300 font-ui text-sm">No students yet — add one above.</p>
        )}

        {students.map((student) => (
          <div
            key={student.id}
            className="bg-forest-900 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <label className="relative shrink-0 cursor-pointer group">
              {photoUrls[student.id] ? (
                <img
                  src={photoUrls[student.id]}
                  alt={student.full_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-forest-700 flex items-center justify-center">
                  <User size={20} className="text-forest-300" />
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                <Camera size={16} className="text-forest-100" />
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handlePhotoChange(student.id, e.target.files?.[0])}
              />
              {uploadingId === student.id && (
                <span className="absolute -bottom-1 -right-1 text-[10px] bg-forest-500 text-forest-950 rounded-full px-1">
                  ...
                </span>
              )}
            </label>

            <div className="flex-1">
              {editingId === student.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="p-2 rounded bg-forest-700 text-forest-100 font-ui flex-1"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveRename(student.id)}
                    className="px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-uitext-xs font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-uitext-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEditing(student)}
                  className="font-display text-lg text-forest-100 text-left hover:underline block"
                >
                  {student.full_name}
                </button>
              )}
              <p className="font-ui text-xs text-forest-300 mt-0.5">ID: {student.unique_student_id}</p>
            </div>

            <select
              value={student.class_id ?? ""}
              onChange={(e) => handleAssignClass(student.id, e.target.value)}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
            >
              <option value="">No class</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <Link
              to={`/admin/students/${student.id}`}
              className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs whitespace-nowrap"
            >
              View Profile →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
