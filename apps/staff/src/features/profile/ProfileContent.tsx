import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  fetchSchoolName,
  uploadOwnPhoto,
  getSignedPhotoUrl,
  updateOwnName,
  changeOwnPassword,
  IncorrectPasswordError,
} from "./api";

const ROLE_LABELS: Record<string, string> = {
  school_admin: "School Admin",
  class_teacher: "Class Teacher",
  shadow_teacher: "Shadow Teacher",
  super_admin: "Super Admin",
};

export default function ProfileContent() {
  const { profile, session, refreshProfile } = useAuth();

  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState(profile?.full_name ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

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
    setNameInput(profile?.full_name ?? "");
  }, [profile?.full_name]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchoolName(profile.school_id).then(setSchoolName);
    }
  }, [profile?.school_id]);

  useEffect(() => {
    if (profile?.photo_url) {
      getSignedPhotoUrl(profile.photo_url).then(setPhotoUrl);
    } else {
      setPhotoUrl(null);
    }
  }, [profile?.photo_url]);

  if (!profile) return null;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setPhotoError(null);
    setPhotoLoading(true);
    try {
      await uploadOwnPhoto(profile.school_id, profile.id, file, profile.id);
      await refreshProfile();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPhotoLoading(false);
      e.target.value = "";
    }
  }

  async function handleNameSave() {
    if (!profile || !nameInput.trim()) return;
    setNameError(null);
    setNameSaved(false);
    setNameSaving(true);
    try {
      await updateOwnName(profile.id, nameInput.trim(), profile.school_id, profile.id);
      await refreshProfile();
      setNameSaved(true);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name.");
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordChange() {
    setPasswordError(null);
    setPasswordSaved(false);
    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (!session?.user?.email) {
      setPasswordError("Missing account email - try signing in again.");
      return;
    }
    setPasswordSaving(true);
    try {
      await changeOwnPassword(session.user.email, currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof IncorrectPasswordError) {
        setPasswordError(err.message);
      } else {
        setPasswordError(err instanceof Error ? err.message : "Failed to change password.");
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Profile</h1>
        <p className="font-ui text-sm text-forest-300 mt-1">
          {ROLE_LABELS[profile.role] ?? profile.role}
          {schoolName ? ` - ${schoolName}` : ""}
        </p>
      </div>

      {/* Photo */}
      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Photo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-forest-800 overflow-hidden flex items-center justify-center text-forest-300 font-ui text-xs">
            {photoUrl ? (
              <img src={photoUrl} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              "No photo"
            )}
          </div>
          <label className="px-3 py-2 rounded bg-forest-700 text-forest-100 font-ui text-sm cursor-pointer hover:bg-forest-600">
            {photoLoading ? "Uploading..." : "Change photo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={photoLoading}
              onChange={handlePhotoChange}
            />
          </label>
        </div>
        {photoError && <p className="font-ui text-xs text-red-400">{photoError}</p>}
      </section>

      {/* Name */}
      <section className="space-y-2">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Full name</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setNameSaved(false);
            }}
            className="flex-1 px-3 py-2 rounded bg-forest-900 border border-forest-700 text-forest-100 font-ui text-sm"
          />
          <button
            onClick={handleNameSave}
            disabled={nameSaving || !nameInput.trim() || nameInput.trim() === profile.full_name}
            className="px-3 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {nameSaving ? "Saving..." : "Save"}
          </button>
        </div>
        {nameError && <p className="font-ui text-xs text-red-400">{nameError}</p>}
        {nameSaved && <p className="font-ui text-xs text-forest-400">Name updated.</p>}
      </section>

      {/* Email (read-only) */}
      <section className="space-y-2">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Email</h2>
        <p className="font-ui text-sm text-forest-300">{session?.user?.email ?? "-"}</p>
      </section>

      {/* Password */}
      <section className="space-y-2">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Change password</h2>
        <div className="relative">
          <label htmlFor="staff-current-password" className="sr-only">Current password</label>
          <input
            id="staff-current-password"
            name="staff-current-password"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPasswordSaved(false);
            }}
            className="w-full px-3 py-2 pr-10 rounded bg-forest-900 border border-forest-700 text-forest-100 font-ui text-sm"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-forest-300 hover:text-forest-100"
            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
          >
            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="relative">
          <label htmlFor="staff-new-password" className="sr-only">New password</label>
          <input
            id="staff-new-password"
            name="staff-new-password"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordSaved(false);
            }}
            className="w-full px-3 py-2 pr-10 rounded bg-forest-900 border border-forest-700 text-forest-100 font-ui text-sm"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-forest-300 hover:text-forest-100"
            aria-label={showNewPassword ? "Hide password" : "Show password"}
          >
            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="relative">
          <label htmlFor="staff-confirm-password" className="sr-only">Confirm new password</label>
          <input
            id="staff-confirm-password"
            name="staff-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordSaved(false);
            }}
            className="w-full px-3 py-2 pr-10 rounded bg-forest-900 border border-forest-700 text-forest-100 font-ui text-sm"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-forest-300 hover:text-forest-100"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          onClick={handlePasswordChange}
          disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
          className="px-3 py-2 rounded bg-forest-700 text-forest-100 font-ui text-sm disabled:opacity-50"
        >
          {passwordSaving ? "Saving..." : "Update password"}
        </button>
        {passwordError && <p className="font-ui text-xs text-red-400">{passwordError}</p>}
        {passwordSaved && <p className="font-ui text-xs text-forest-400">Password updated.</p>}
      </section>
    </div>
  );
}
