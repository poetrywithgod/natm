import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { getFriendlyErrorMessage } from "@natm/supabase";
import {
  fetchStaff,
  createStaffMember,
  deactivateStaffMember,
  reactivateStaffMember,
  deleteStaffMember,
  DeactivationBlockedError,
  type StaffMember,
} from "../features/staff/api";

const ROLE_LABELS: Record<StaffMember["role"], string> = {
  class_teacher: "Class Teacher",
  shadow_teacher: "Shadow Teacher",
  finance_manager: "Finance Manager",
};

export default function AdminStaffManagement() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<StaffMember["role"]>("class_teacher");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockedReasons, setBlockedReasons] = useState<{ id: string; reasons: string[] } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // The temporary password is only ever available right after creation --
  // it isn't stored anywhere -- so it lives in component state until the
  // admin dismisses the card.
  const [credentials, setCredentials] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const schoolId = profile?.school_id;

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      setStaff(await fetchStaff(schoolId, showInactive));
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to load staff"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, showInactive]);

  async function handleInvite() {
    if (!newName.trim() || !newEmail.trim()) return;
    setInviting(true);
    setError(null);
    setSuccessMessage(null);
    setCredentials(null);
    setCopied(false);
    try {
      const email = newEmail.trim();
      const name = newName.trim();
      const created = await createStaffMember(name, email, newRole);
      setCredentials({ name, email, password: created.temporaryPassword });
      setNewName("");
      setNewEmail("");
      await loadAll();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to add staff member"));
    } finally {
      setInviting(false);
    }
  }

  async function handleCopyCredentials() {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${credentials.email}\nTemporary password: ${credentials.password}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the password is
      // still on screen to copy by hand.
    }
  }

  async function handleDeactivate(staffId: string) {
    setProcessingId(staffId);
    setError(null);
    setBlockedReasons(null);
    setSuccessMessage(null);
    try {
      await deactivateStaffMember(staffId);
      setSuccessMessage("Staff member deactivated.");
      await loadAll();
    } catch (e) {
      if (e instanceof DeactivationBlockedError) {
        setBlockedReasons({ id: staffId, reasons: e.reasons });
      } else {
        setError(getFriendlyErrorMessage(e, "Failed to deactivate staff member"));
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDelete(staffId: string, fullName: string) {
    if (!window.confirm(`Permanently delete ${fullName}? This cannot be undone.`)) return;
    setProcessingId(staffId);
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteStaffMember(staffId);
      setSuccessMessage("Staff member deleted.");
      await loadAll();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to delete staff member"));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReactivate(staffId: string) {
    setProcessingId(staffId);
    setError(null);
    setSuccessMessage(null);
    try {
      await reactivateStaffMember(staffId);
      setSuccessMessage("Staff member reactivated.");
      await loadAll();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to reactivate staff member"));
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-forest-100">Staff Management</h1>
        <label className="flex items-center gap-2 font-ui text-xs text-forest-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show deactivated staff
        </label>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {successMessage && <p className="text-forest-300 font-ui text-sm">{successMessage}</p>}

      <div className="bg-forest-900 rounded-lg p-4 flex flex-col sm:flex-row gap-2">
        <input
          id="new-staff-name"
          name="new-staff-name"
          type="text"
          autoComplete="off"
          placeholder="Full name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
        />
        <input
          id="new-staff-email"
          name="new-staff-email"
          type="email"
          autoComplete="off"
          placeholder="Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as StaffMember["role"])}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
        >
          <option value="class_teacher">Class Teacher</option>
          <option value="shadow_teacher">Shadow Teacher</option>
          {/* Homeschool tenants have no internal fees, so no Finance Manager. */}
          {profile?.role !== "homeschool_teacher" && <option value="finance_manager">Finance Manager</option>}
        </select>
        <button
          onClick={handleInvite}
          disabled={inviting}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold whitespace-nowrap"
        >
          {inviting ? "Adding..." : "Add Staff"}
        </button>
      </div>
      <p className="font-ui text-xs text-forest-300 -mt-4">
        A temporary password is generated for them. At first sign-in they must set their own.
      </p>

      {credentials && (
        <div className="bg-forest-900 border border-forest-500/40 rounded-lg p-4 space-y-3">
          <div>
            <p className="font-display text-forest-100">{credentials.name} was added</p>
            <p className="font-ui text-xs text-forest-300 mt-1">
              Share these sign-in details with them. This password is shown only once and can't be
              retrieved later.
            </p>
          </div>
          <div className="rounded bg-forest-700 p-3 space-y-1 font-ui text-sm">
            <p className="text-forest-300">
              Email: <span className="text-forest-100 break-all">{credentials.email}</span>
            </p>
            <p className="text-forest-300">
              Temporary password:{" "}
              <span className="text-forest-100 font-mono tracking-wide select-all">{credentials.password}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyCredentials}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy details"}
            </button>
            <button
              onClick={() => setCredentials(null)}
              className="px-3 py-1.5 rounded border border-forest-100/20 text-forest-100 font-ui text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {staff.length === 0 && (
          <p className="text-forest-300 font-ui text-sm">
            {showInactive ? "No deactivated staff." : "No staff yet — invite one above."}
          </p>
        )}

        {staff.map((member) => (
          <div key={member.id} className="bg-forest-900 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-display text-forest-100">{member.full_name}</span>
                {!member.is_active && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-error/20 text-error font-ui">
                    Deactivated
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-forest-700 text-forest-100 font-ui">
                  {ROLE_LABELS[member.role]}
                </span>
                {member.is_active ? (
                  <button
                    onClick={() => handleDeactivate(member.id)}
                    disabled={processingId === member.id}
                    className="px-3 py-1.5 rounded bg-error/20 text-error font-ui text-xs disabled:opacity-50"
                  >
                    {processingId === member.id ? "..." : "Deactivate"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleReactivate(member.id)}
                    disabled={processingId === member.id}
                    className="px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold disabled:opacity-50"
                  >
                    {processingId === member.id ? "..." : "Reactivate"}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(member.id, member.full_name)}
                  disabled={processingId === member.id}
                  className="px-3 py-1.5 rounded border border-error/40 text-error font-ui text-xs disabled:opacity-50"
                >
                  {processingId === member.id ? "..." : "Delete"}
                </button>
              </div>
            </div>

            {blockedReasons?.id === member.id && (
              <div className="bg-error/10 border border-error/30 rounded p-2 space-y-1">
                <p className="font-ui text-xs text-error font-semibold">Can't deactivate yet:</p>
                {blockedReasons.reasons.map((reason, i) => (
                  <p key={i} className="font-ui text-xs text-error">
                    • {reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
