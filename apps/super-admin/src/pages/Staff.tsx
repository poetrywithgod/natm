import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Search, UserPlus } from "lucide-react";
import {
  fetchAllStaff,
  inviteStaff,
  deactivateStaff,
  reactivateStaff,
  deleteStaffMember,
  DeactivationBlockedError,
  STAFF_ROLES,
  type StaffRow,
  type StaffRole,
} from "../features/staff/api";
import { fetchSchools, type SchoolRow } from "../features/schools/api";

const ROLE_LABELS: Record<StaffRole, string> = {
  school_admin: "School Admin",
  class_teacher: "Class Teacher",
  shadow_teacher: "Shadow Teacher",
  finance_manager: "Finance Manager",
};

export default function Staff() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [schoolFilter, setSchoolFilter] = useState<string | "all">("all");
  const [showInactive, setShowInactive] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [blockedReasons, setBlockedReasons] = useState<{ id: string; reasons: string[] } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, sc] = await Promise.all([fetchAllStaff(), fetchSchools()]);
      setStaff(s);
      setSchools(sc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      if (!showInactive && !s.is_active) return false;
      if (roleFilter !== "all" && s.role !== roleFilter) return false;
      if (schoolFilter !== "all" && s.school_id !== schoolFilter) return false;
      if (search.trim() && !s.full_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [staff, search, roleFilter, schoolFilter, showInactive]);

  async function handleDeactivate(staffId: string) {
    setProcessingId(staffId);
    setError(null);
    setBlockedReasons(null);
    setSuccessMessage(null);
    try {
      await deactivateStaff(staffId);
      setSuccessMessage("Staff member deactivated.");
      await load();
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

  async function handleReactivate(staffId: string) {
    setProcessingId(staffId);
    setError(null);
    setSuccessMessage(null);
    try {
      await reactivateStaff(staffId);
      setSuccessMessage("Staff member reactivated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reactivate staff member");
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete staff member");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-100">Staff</h1>
          <p className="font-body text-sm text-slate-400 mt-1">Every staff member across the platform.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold"
        >
          <UserPlus size={16} /> Invite Staff
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-body text-sm placeholder:text-slate-500 w-56"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as StaffRole | "all")}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-ui text-sm"
        >
          <option value="all">All roles</option>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-ui text-sm max-w-[14rem]"
        >
          <option value="all">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 font-ui text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show deactivated
        </label>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}
      {successMessage && <p className="font-ui text-sm text-success">{successMessage}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Users className="mx-auto text-slate-600 mb-2" size={28} />
          <p className="font-ui text-sm text-slate-400">
            {staff.length === 0 ? "No staff yet — invite the first one." : "No staff match these filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((member) => (
            <div key={member.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-slate-100">{member.full_name}</span>
                  <span className="font-ui text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                    {ROLE_LABELS[member.role]}
                  </span>
                  <Link
                    to={`/schools/${member.school_id}`}
                    className="font-ui text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 hover:text-amber-400"
                  >
                    {member.school_name}
                  </Link>
                  {!member.is_active && (
                    <span className="font-ui text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                      Deactivated
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {member.is_active ? (
                    <button
                      onClick={() => handleDeactivate(member.id)}
                      disabled={processingId === member.id}
                      className="px-3 py-1.5 rounded-lg bg-error/10 text-error font-ui text-xs disabled:opacity-50"
                    >
                      {processingId === member.id ? "..." : "Deactivate"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(member.id)}
                      disabled={processingId === member.id}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-ui text-xs font-semibold disabled:opacity-50"
                    >
                      {processingId === member.id ? "..." : "Reactivate"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(member.id, member.full_name)}
                    disabled={processingId === member.id}
                    className="px-3 py-1.5 rounded-lg border border-error/40 text-error font-ui text-xs disabled:opacity-50"
                  >
                    {processingId === member.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>

              {blockedReasons?.id === member.id && (
                <div className="bg-error/10 border border-error/30 rounded-lg p-2 space-y-1">
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
      )}

      {showInvite && (
        <InviteStaffModal
          schools={schools}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            setSuccessMessage("Invite sent.");
            load();
          }}
        />
      )}
    </div>
  );
}

function InviteStaffModal({
  schools,
  onClose,
  onInvited,
}: {
  schools: SchoolRow[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("class_teacher");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!schoolId || !fullName.trim() || !email.trim()) {
      setError("School, full name, and email are all required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await inviteStaff(schoolId, fullName.trim(), email.trim(), role);
      onInvited();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to invite staff member");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-100">Invite Staff</h2>

        <div className="space-y-3">
          <div>
            <label className="font-ui text-xs text-slate-400">School</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
            >
              {schools.length === 0 && <option value="">No schools yet</option>}
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
            />
          </div>
        </div>

        {error && <p className="font-ui text-xs text-error">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
