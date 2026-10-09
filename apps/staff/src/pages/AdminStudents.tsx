import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, User, X } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchStudents,
  fetchClassOptions,
  createFamilyAdmission,
  assignStudentClass,
  renameStudent,
  uploadStudentPhoto,
  getSignedPhotoUrl,
  type Student,
  type ClassOption,
  type FamilyAdmissionResult,
} from "../features/students/api";
import { classLevelRank } from "../features/classes/api";
import { getFriendlyErrorMessage } from "@natm/supabase";

const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Other"];

const UNASSIGNED_GROUP_KEY = "unassigned";

interface StudentClassGroup {
  key: string;
  label: string;
  students: Student[];
}

// Students in class-level progression order (Creche → SS3), then by class
// name within a level, then alphabetically within a class. Students with no
// class yet (pending assessment) always fall in their own group at the end,
// rather than being scattered alphabetically among classed students.
function sortAndGroupStudents(students: Student[], classOptions: ClassOption[]): StudentClassGroup[] {
  const classMap = new Map(classOptions.map((c) => [c.id, c]));

  const sorted = [...students].sort((a, b) => {
    const classA = a.class_id ? classMap.get(a.class_id) : undefined;
    const classB = b.class_id ? classMap.get(b.class_id) : undefined;
    const rankDiff = classLevelRank(classA?.level) - classLevelRank(classB?.level);
    if (rankDiff !== 0) return rankDiff;
    const nameDiff = (classA?.name ?? "").localeCompare(classB?.name ?? "");
    if (nameDiff !== 0) return nameDiff;
    return a.full_name.localeCompare(b.full_name);
  });

  const groups: StudentClassGroup[] = [];
  for (const student of sorted) {
    const cls = student.class_id ? classMap.get(student.class_id) : undefined;
    const key = cls?.id ?? UNASSIGNED_GROUP_KEY;
    const label = cls?.name ?? "No Class (Pending Assessment)";
    let group = groups[groups.length - 1]?.key === key ? groups[groups.length - 1] : undefined;
    if (!group) {
      group = { key, label, students: [] };
      groups.push(group);
    }
    group.students.push(student);
  }
  return groups;
}

export default function AdminStudents() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCredentials, setNewCredentials] = useState<FamilyAdmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const schoolId = profile?.school_id;

  const studentGroups = useMemo(
    () => sortAndGroupStudents(students, classOptions),
    [students, classOptions]
  );

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
      setError(getFriendlyErrorMessage(e, "Failed to load students"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function handleCreateStudent() {
    if (!newName.trim() || !guardianName.trim() || !guardianEmail.trim() || !guardianRelationship) {
      setError("Student name, and the guardian's name, email and relationship are required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const result = await createFamilyAdmission({
        child: { full_name: newName.trim(), class_id: newClassId || null },
        guardian: {
          email: guardianEmail.trim(),
          full_name: guardianName.trim(),
          relationship: guardianRelationship,
          phone: guardianPhone.trim() || undefined,
          address: guardianAddress.trim() || undefined,
        },
      });
      setNewCredentials(result);
      setNewName("");
      setNewClassId("");
      setGuardianName("");
      setGuardianEmail("");
      setGuardianRelationship("");
      setGuardianPhone("");
      setGuardianAddress("");
      await loadAll();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to admit student"));
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignClass(studentId: string, classId: string) {
    try {
      await assignStudentClass(studentId, classId === "" ? null : classId, schoolId!, profile!.id);
      await loadAll();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to assign class"));
    }
  }

  function startEditing(student: Student) {
    setEditingId(student.id);
    setEditingName(student.full_name);
  }

  async function handleSaveRename(studentId: string) {
    if (!editingName.trim()) return;
    try {
      await renameStudent(studentId, editingName.trim(), schoolId!, profile!.id);
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to rename student"));
    }
  }

  async function handlePhotoChange(studentId: string, file: File | undefined) {
    if (!schoolId || !file) return;
    setUploadingId(studentId);
    try {
      await uploadStudentPhoto(schoolId, studentId, file, profile!.id);
      await loadAll();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to upload photo"));
    } finally {
      setUploadingId(null);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Students</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="bg-forest-900 rounded-lg p-4 space-y-4">
        <div className="space-y-2">
          <h2 className="font-display text-sm text-forest-300 uppercase tracking-wide">Student</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Student full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
            />
            <select
              value={newClassId}
              onChange={(e) => setNewClassId(e.target.value)}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
            >
              <option value="">No class yet (pending assessment)</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-sm text-forest-300 uppercase tracking-wide">Parent / Guardian (required)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Guardian full name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60" />
            <input type="email" placeholder="Family email (shared login)" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60" />
            <select
              value={guardianRelationship}
              onChange={(e) => setGuardianRelationship(e.target.value)}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
            >
              <option value="">Relationship to student</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input type="tel" placeholder="Phone (optional)" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60" />
            <input type="text" placeholder="Address (optional)" value={guardianAddress} onChange={(e) => setGuardianAddress(e.target.value)} className="sm:col-span-2 p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60" />
          </div>
        </div>

        <button
          onClick={handleCreateStudent}
          disabled={creating}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold whitespace-nowrap disabled:opacity-50"
        >
          {creating ? "Admitting..." : "Admit Student"}
        </button>
      </div>
      <p className="font-ui text-xs text-forest-300 -mt-4">
        One shared family email is used for the parent and the student: the family signs in once and switches between Parent view and Student view. A Student ID and a temporary password are generated automatically, and the family must set their own password on first login. Class/level is assigned later, after assessment.
      </p>

      {newCredentials && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-forest-900 rounded-lg p-6 max-w-sm w-full space-y-4 relative">
            <button
              onClick={() => setNewCredentials(null)}
              className="absolute top-3 right-3 text-forest-300 hover:text-forest-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2 className="font-display text-lg text-forest-100">Student Admitted</h2>
            {newCredentials.temporary_password ? (
              <p className="font-ui text-xs text-forest-300">
                Share these details with the family now — the temporary password is shown only once. They must set a new password on first login.
              </p>
            ) : (
              <p className="font-ui text-xs text-forest-300">
                This family already has an account, so the child was added to it. No new password was created — they sign in with their existing one and will see the new child.
              </p>
            )}
            <div className="bg-forest-700 rounded p-3 space-y-1 font-ui text-sm text-forest-100">
              <p><span className="text-forest-300">Student ID:</span> {newCredentials.unique_student_id}</p>
              <p><span className="text-forest-300">Family email:</span> {newCredentials.guardian_email}</p>
              {newCredentials.temporary_password && (
                <p><span className="text-forest-300">Temporary Password:</span> {newCredentials.temporary_password}</p>
              )}
            </div>
            {newCredentials.temporary_password && (
              <p className="font-ui text-xs text-forest-300">
                {newCredentials.password_email_sent
                  ? "A password-setup email was also sent to the guardian."
                  : "The automatic email could not be sent, so please share the password directly."}
              </p>
            )}
            <button
              onClick={() => setNewCredentials(null)}
              className="w-full py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {students.length === 0 && (
          <p className="text-forest-300 font-ui text-sm">No students yet — add one above.</p>
        )}

        {studentGroups.map((group) => (
        <div key={group.key} className="space-y-3">
          <h2 className="font-display text-sm text-forest-300 uppercase tracking-wide">
            {group.label} <span className="font-ui normal-case text-forest-300/70">({group.students.length})</span>
          </h2>

          {group.students.map((student) => (
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
        ))}
      </div>
    </div>
  );
}
