import { useEffect, useRef, useState } from "react";
import { Camera, Eye, EyeOff, User } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchOwnStudentRecord,
  getSignedStudentPhotoUrl,
  uploadOwnStudentPhoto,
  changeOwnPassword,
  IncorrectPasswordError,
  type StudentRecord,
} from "../features/profile/api";
import { fetchSchoolInfo, type SchoolInfo } from "../features/schools/api";

export default function StudentSettings() {
  const { profile, session, signOut } = useAuth();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    (async () => {
      const record = await fetchOwnStudentRecord(profile.id);
      if (cancelled || !record) return;
      setStudent(record);
      if (record.photo_url) {
        const url = await getSignedStudentPhotoUrl(record.photo_url);
        if (!cancelled) setPhotoUrl(url);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchoolInfo(profile.school_id).then(setSchool);
    }
  }, [profile?.school_id]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !student) return;
    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const path = await uploadOwnStudentPhoto(student.id, file);
      const url = await getSignedStudentPhotoUrl(path);
      setPhotoUrl(url);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleChangePassword() {
    if (!session?.user.email) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await changeOwnPassword(session.user.email, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(
        err instanceof IncorrectPasswordError ? err.message : err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="font-display text-xl text-abyssal-100">Profile</h1>

      {/* Identity */}
      <div className="bg-abyssal-900 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={photoUploading}
            className="relative w-16 h-16 rounded-full bg-abyssal-800 flex items-center justify-center overflow-hidden shrink-0"
          >
            {photoUrl ? (
              <img src={photoUrl} alt={student?.full_name ?? "Profile"} className="w-full h-full object-cover" />
            ) : (
              <User size={28} className="text-abyssal-300" />
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 flex justify-center">
              <Camera size={12} className="text-abyssal-100" />
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          <div>
            <p className="font-ui text-sm text-abyssal-100">{student?.full_name ?? profile?.full_name}</p>
            <p className="font-ui text-xs text-abyssal-300 mt-0.5">
              ID: {student?.unique_student_id ?? "—"} · Class: {student?.class_name ?? "Unassigned"}
            </p>
          </div>
        </div>
        {photoError && <p className="font-ui text-xs text-error">{photoError}</p>}
        {school && <p className="font-ui text-xs text-abyssal-300">{school.name}</p>}
      </div>

      {/* Change password */}
      <div className="bg-abyssal-900 rounded-lg p-4 space-y-3">
        <h2 className="font-display text-lg text-abyssal-100">Change Password</h2>

        <div className="relative">
          <input
            type={showCurrentPassword ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 pr-10 font-ui text-sm text-abyssal-100"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-abyssal-300"
          >
            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="relative">
          <input
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 pr-10 font-ui text-sm text-abyssal-100"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-abyssal-300"
          >
            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 pr-10 font-ui text-sm text-abyssal-100"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-abyssal-300"
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {passwordError && <p className="font-ui text-xs text-error">{passwordError}</p>}
        {passwordSaved && <p className="font-ui text-xs text-success">Password updated.</p>}

        <button
          onClick={handleChangePassword}
          disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
          className="px-4 py-2 rounded bg-abyssal-500 text-abyssal-950 font-ui text-sm font-semibold disabled:opacity-50"
        >
          {passwordSaving ? "Updating..." : "Update Password"}
        </button>
      </div>

      <button
        onClick={signOut}
        className="px-4 py-2 rounded bg-abyssal-700 text-abyssal-100 font-ui text-sm"
      >
        Sign out
      </button>
    </div>
  );
}
