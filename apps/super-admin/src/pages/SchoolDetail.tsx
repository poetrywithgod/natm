import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Building2, Users, GraduationCap, Trash2, UserPlus } from "lucide-react";
import {
  fetchSchool,
  fetchSchoolAdmins,
  updateSchoolDetails,
  setSchoolActive,
  inviteSchoolAdmin,
  deleteSchool,
  type SchoolRow,
  type SchoolAdminRow,
} from "../features/schools/api";

export default function SchoolDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [admins, setAdmins] = useState<SchoolAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [s, a] = await Promise.all([fetchSchool(id), fetchSchoolAdmins(id)]);
      if (!s) {
        setError("School not found.");
        return;
      }
      setSchool(s);
      setAdmins(a);
      setName(s.name);
      setContactEmail(s.contact_email ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load school");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaveDetails() {
    if (!id || !name.trim()) return;
    setSavingDetails(true);
    setError(null);
    try {
      await updateSchoolDetails(id, { name: name.trim(), contact_email: contactEmail.trim() || null });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleToggleActive() {
    if (!id || !school) return;
    setTogglingActive(true);
    try {
      await setSchoolActive(id, !school.is_active);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setTogglingActive(false);
    }
  }

  async function handleInviteAdmin() {
    if (!id || !inviteName.trim() || !inviteEmail.trim()) return;
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      await inviteSchoolAdmin(id, inviteName.trim(), inviteEmail.trim());
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      await load();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to invite School Admin");
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!id || !school) return;
    if (!window.confirm(`Permanently delete "${school.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSchool(id);
      navigate("/schools");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete school");
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-6 font-ui text-sm text-slate-400">Loading...</div>;
  }
  if (!school) {
    return (
      <div className="p-6 space-y-3">
        <p className="font-ui text-sm text-error">{error ?? "School not found."}</p>
        <Link to="/schools" className="font-ui text-xs text-amber-400 hover:underline">
          Back to Schools
        </Link>
      </div>
    );
  }

  const isEmpty = school.student_count === 0 && school.staff_count === 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link to="/schools" className="flex items-center gap-1 font-ui text-xs text-slate-400 hover:text-slate-100 w-fit">
        <ArrowLeft size={14} /> Back to Schools
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center">
            <Building2 size={20} className="text-amber-500" />
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold text-slate-100">{school.name}</h1>
            <span
              className={`font-ui text-xs px-2 py-0.5 rounded-full ${
                school.is_active ? "bg-success/10 text-success" : "bg-slate-700 text-slate-400"
              }`}
            >
              {school.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <button
          onClick={handleToggleActive}
          disabled={togglingActive}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm disabled:opacity-60"
        >
          {togglingActive ? "Updating..." : school.is_active ? "Deactivate School" : "Activate School"}
        </button>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <GraduationCap size={18} className="text-amber-500" />
          <div>
            <p className="font-display text-xl font-bold text-slate-100">{school.student_count}</p>
            <p className="font-ui text-xs text-slate-400">Students</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <Users size={18} className="text-amber-500" />
          <div>
            <p className="font-display text-xl font-bold text-slate-100">{school.staff_count}</p>
            <p className="font-ui text-xs text-slate-400">Staff (incl. Admins)</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="font-display font-bold text-slate-100">Details</h2>
        <div>
          <label className="font-ui text-xs text-slate-400">School name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          />
        </div>
        <div>
          <label className="font-ui text-xs text-slate-400">Contact email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          />
        </div>
        <button
          onClick={handleSaveDetails}
          disabled={savingDetails}
          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
        >
          {savingDetails ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-slate-100">School Admins</h2>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1 font-ui text-xs text-amber-400 hover:underline"
          >
            <UserPlus size={14} /> Invite Admin
          </button>
        </div>
        {admins.length === 0 ? (
          <p className="font-ui text-xs text-slate-400">No School Admin yet — invite one to get this school started.</p>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                <span className="font-body text-sm text-slate-100">{a.full_name}</span>
                <span
                  className={`font-ui text-xs px-2 py-0.5 rounded-full ${
                    a.is_active ? "bg-success/10 text-success" : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {a.is_active ? "Active" : "Deactivated"}
                </span>
              </div>
            ))}
          </div>
        )}

        {showInvite && (
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <input
              placeholder="Full name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
            />
            {inviteError && <p className="font-ui text-xs text-error">{inviteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowInvite(false)}
                disabled={inviteSubmitting}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteAdmin}
                disabled={inviteSubmitting}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
              >
                {inviteSubmitting ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-error/30 rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-bold text-error">Danger Zone</h2>
        <p className="font-ui text-xs text-slate-400">
          {isEmpty
            ? "This school has no students or staff yet — it can be permanently deleted if it was created by mistake."
            : "This school has real data (students and/or staff) and can't be deleted. Deactivate it above instead."}
        </p>
        <button
          onClick={handleDelete}
          disabled={!isEmpty || deleting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error/10 text-error font-ui text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete School"}
        </button>
      </div>
    </div>
  );
}
