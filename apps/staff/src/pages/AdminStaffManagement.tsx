import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchStaff, createStaffMember, type StaffMember } from "../features/staff/api";

const ROLE_LABELS: Record<StaffMember["role"], string> = {
  class_teacher: "Class Teacher",
  shadow_teacher: "Shadow Teacher",
  finance_manager: "Finance Manager",
};

export default function AdminStaffManagement() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<StaffMember["role"]>("class_teacher");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const schoolId = profile?.school_id;

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      setStaff(await fetchStaff(schoolId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

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

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Staff Management</h1>

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
          <p className="text-forest-300 font-ui text-sm">No staff yet — invite one above.</p>
        )}

        {staff.map((member) => (
          <div key={member.id} className="bg-forest-900 rounded-lg p-4 flex items-center justify-between">
            <span className="font-display text-forest-100">{member.full_name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-forest-700 text-forest-100 font-ui">
              {ROLE_LABELS[member.role]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
