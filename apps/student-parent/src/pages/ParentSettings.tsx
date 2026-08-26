import { useEffect, useState } from "react";
import { Eye, EyeOff, Camera } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchOwnParentProfile,
  updateOwnName,
  updateOwnContactDetails,
  uploadOwnParentPhoto,
  getSignedParentPhotoUrl,
  fetchLinkedChildrenWithRelationship,
  updateRelationship,
  changeOwnPassword,
  IncorrectPasswordError,
  type OwnParentProfile,
  type LinkedChildLite,
} from "../features/parentProfile/api";
import { useToast } from "../features/toast/ToastContext";

const RELATIONSHIP_OPTIONS = ["Mother", "Father", "Guardian", "Other"];

export default function ParentSettings() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const { showToast } = useToast();

  const [ownProfile, setOwnProfile] = useState<OwnParentProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [children, setChildren] = useState<LinkedChildLite[]>([]);
  const [savingRelationshipId, setSavingRelationshipId] = useState<string | null>(null);

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
      const [own, kids] = await Promise.all([
        fetchOwnParentProfile(profile.id),
        fetchLinkedChildrenWithRelationship(profile.id),
      ]);
      if (cancelled) return;
      if (own) {
        setOwnProfile(own);
        setFullName(own.full_name);
        setPhone(own.phone ?? "");
        setAddress(own.address ?? "");
        if (own.photo_url) {
          const url = await getSignedParentPhotoUrl(own.photo_url);
          if (!cancelled) setPhotoUrl(url);
        }
      }
      setChildren(kids);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setUploadingPhoto(true);
    try {
      const path = await uploadOwnParentPhoto(profile.id, file);
      const url = await getSignedParentPhotoUrl(path);
      setPhotoUrl(url);
      await refreshProfile();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to upload photo", "error");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveDetails() {
    if (!profile?.id) return;
    setDetailsSaving(true);
    setDetailsError(null);
    setDetailsSaved(false);
    try {
      if (fullName.trim() && fullName.trim() !== ownProfile?.full_name) {
        await updateOwnName(profile.id, fullName.trim());
      }
      await updateOwnContactDetails(profile.id, { phone, address });
      await refreshProfile();
      setDetailsSaved(true);
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setDetailsSaving(false);
    }
  }

  async function handleRelationshipChange(linkId: string, relationship: string) {
    setSavingRelationshipId(linkId);
    try {
      await updateRelationship(linkId, relationship);
      setChildren((prev) => prev.map((c) => (c.link_id === linkId ? { ...c, relationship } : c)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update relationship", "error");
    } finally {
      setSavingRelationshipId(null);
    }
  }

  async function handleChangePassword() {
    if (!session?.user?.email) return;
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
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
        setPasswordError(err instanceof Error ? err.message : "Failed to change password");
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-6 pb-8">
      <h1 className="font-display text-xl text-abyssal-100">Settings</h1>

      {/* Photo + Name */}
      <div className="bg-abyssal-900 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-abyssal-700 overflow-hidden flex items-center justify-center text-abyssal-300 font-ui text-lg shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (ownProfile?.full_name ?? "?").charAt(0)
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-lime text-abyssal-950 flex items-center justify-center cursor-pointer">
              <Camera size={12} />
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoChange} disabled={uploadingPhoto} />
            </label>
          </div>
          <div className="flex-1">
            <label htmlFor="parent-full-name" className="font-ui text-xs text-abyssal-300">Full name</label>
            <input
              id="parent-full-name"
              name="parent-full-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 font-ui text-sm text-abyssal-100"
            />
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-abyssal-900 rounded-lg p-4 space-y-3">
        <h2 className="font-display text-lg text-abyssal-100">Contact Information</h2>

        <div>
          <label htmlFor="parent-phone" className="font-ui text-xs text-abyssal-300">Phone</label>
          <input
            id="parent-phone"
            name="parent-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="mt-1 w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 font-ui text-sm text-abyssal-100"
          />
        </div>

        <div>
          <label htmlFor="parent-address" className="font-ui text-xs text-abyssal-300">Address</label>
          <input
            id="parent-address"
            name="parent-address"
            type="text"
            autoComplete="off"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Home address"
            className="mt-1 w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 font-ui text-sm text-abyssal-100"
          />
        </div>

        {detailsError && <p className="font-ui text-xs text-error">{detailsError}</p>}
        {detailsSaved && <p className="font-ui text-xs text-success">Saved.</p>}

        <button
          onClick={handleSaveDetails}
          disabled={detailsSaving}
          className="px-4 py-2 rounded bg-abyssal-500 text-abyssal-950 font-ui text-sm font-semibold disabled:opacity-50"
        >
          {detailsSaving ? "Saving..." : "Save Details"}
        </button>
      </div>

      {/* Children + relationship */}
      {children.length > 0 && (
        <div className="bg-abyssal-900 rounded-lg p-4 space-y-3">
          <h2 className="font-display text-lg text-abyssal-100">My Children</h2>
          {children.map((c) => (
            <div key={c.link_id} className="flex items-center justify-between gap-3">
              <p className="font-ui text-sm text-abyssal-100">{c.full_name}</p>
              <select
                value={c.relationship ?? ""}
                onChange={(e) => handleRelationshipChange(c.link_id, e.target.value)}
                disabled={savingRelationshipId === c.link_id}
                className="rounded-md border border-abyssal-700 bg-abyssal-950 px-2 py-1.5 font-ui text-sm text-abyssal-100"
              >
                <option value="">Relationship</option>
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Change password */}
      <div className="bg-abyssal-900 rounded-lg p-4 space-y-3">
        <h2 className="font-display text-lg text-abyssal-100">Change Password</h2>

        <div className="relative">
          <label htmlFor="parent-current-password" className="sr-only">Current password</label>
          <input
            id="parent-current-password"
            name="parent-current-password"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="new-password"
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
          <label htmlFor="parent-new-password" className="sr-only">New password</label>
          <input
            id="parent-new-password"
            name="parent-new-password"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
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
          <label htmlFor="parent-confirm-password" className="sr-only">Confirm new password</label>
          <input
            id="parent-confirm-password"
            name="parent-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
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
        {passwordSaved && <p className="font-ui text-xs text-success">Password changed.</p>}

        <button
          onClick={handleChangePassword}
          disabled={passwordSaving}
          className="px-4 py-2 rounded bg-abyssal-500 text-abyssal-950 font-ui text-sm font-semibold disabled:opacity-50"
        >
          {passwordSaving ? "Saving..." : "Change Password"}
        </button>
      </div>

      <button
        onClick={signOut}
        className="w-full px-4 py-2 rounded bg-abyssal-900 text-error font-ui text-sm font-semibold"
      >
        Sign out
      </button>
    </div>
  );
}
