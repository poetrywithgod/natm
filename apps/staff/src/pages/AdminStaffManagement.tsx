import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
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

  const schoolId = profile?.school_id;

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      setStaff(await fetchStaff(schoolId, showInactive));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
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
    try {
      await createStaffMember(newName.trim(), newEmail.trim(), newRole);
      setSuccessMessage(`Invite sent to ${newEmail.trim()}.`);
      setNewName("");
      setNewEmail("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to invite staff member");
    } finally {
      setInviting(false);
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
        setError(e instanceof Error ? e.message : "Failed to deactivate staff member");
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
      setError(e instanceof Error ? e.message : "Failed to delete staff member");
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
      setError(e instanceof Error ? e.message : "Failed to reactivate staff member");
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
          type="text"
          placeholder="Full name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
        />
        <input
          type="email"
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
          <option value="finance_manager">Finance Manager</option>
        </select>
        <button
          onClick={handleInvite}
          disabled={inviting}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold whitespace-nowrap"
        >
          {inviting ? "Inviting..." : "Invite Staff"}
        </button>
      </div>
      <p className="font-ui text-xs text-forest-300 -mt-4">
        They'll receive an email invite to set their own password.
      </p>

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
