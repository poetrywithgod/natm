import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  uploadOwnPhoto,
  getSignedPhotoUrl,
  updateOwnName,
  changeOwnPassword,
  IncorrectPasswordError,
} from "../features/profile/api";

export default function Profile() {
  const { profile, session, refreshProfile } = useAuth();

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
      await uploadOwnPhoto(profile.id, file);
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
      await updateOwnName(profile.id, nameInput.trim());
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
      setPasswordError("Missing account email — try signing in again.");
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
    <div className="p-6 space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100">Profile</h1>
        <p className="font-body text-sm text-slate-400 mt-1 flex items-center gap-1">
          <ShieldCheck size={14} className="text-amber-500" /> Super Admin
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-bold text-slate-100">Photo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-slate-400 font-ui text-xs">
            {photoUrl ? (
              <img src={photoUrl} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              "No photo"
            )}
          </div>
          <label className="px-3 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm cursor-pointer hover:bg-slate-700">
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
        {photoError && <p className="font-ui text-xs text-error">{photoError}</p>}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
        <h2 className="font-display font-bold text-slate-100">Full name</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setNameSaved(false);
            }}
            className="flex-1 p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          />
          <button
            onClick={handleNameSave}
            disabled={nameSaving || !nameInput.trim() || nameInput.trim() === profile.full_name}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {nameSaving ? "Saving..." : "Save"}
          </button>
        </div>
        {nameError && <p className="font-ui text-xs text-error">{nameError}</p>}
        {nameSaved && <p className="font-ui text-xs text-success">Name updated.</p>}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
        <h2 className="font-display font-bold text-slate-100">Email</h2>
        <p className="font-body text-sm text-slate-400">{session?.user?.email ?? "—"}</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-bold text-slate-100">Change password</h2>
        <div className="relative">
          <label htmlFor="super-admin-current-password" className="sr-only">
            Current password
          </label>
          <input
            id="super-admin-current-password"
            name="super-admin-current-password"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPasswordSaved(false);
            }}
            className="w-full p-2 pr-10 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
            aria-label={showCurrentPassword ? "Hide password" : "Show password"}
          >
            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="relative">
          <label htmlFor="super-admin-new-password" className="sr-only">
            New password
          </label>
          <input
            id="super-admin-new-password"
            name="super-admin-new-password"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordSaved(false);
            }}
            className="w-full p-2 pr-10 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
            aria-label={showNewPassword ? "Hide password" : "Show password"}
          >
            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="relative">
          <label htmlFor="super-admin-confirm-password" className="sr-only">
            Confirm new password
          </label>
          <input
            id="super-admin-confirm-password"
            name="super-admin-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordSaved(false);
            }}
            className="w-full p-2 pr-10 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          onClick={handlePasswordChange}
          disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm disabled:opacity-50"
        >
          {passwordSaving ? "Saving..." : "Update password"}
        </button>
        {passwordError && <p className="font-ui text-xs text-error">{passwordError}</p>}
        {passwordSaved && <p className="font-ui text-xs text-success">Password updated.</p>}
      </div>
    </div>
  );
}
