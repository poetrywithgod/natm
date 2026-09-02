import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Building2, Users, GraduationCap, Trash2, UserPlus, Pencil } from "lucide-react";
import {
  fetchSchool,
  updateSchoolDetails,
  setSchoolActive,
  deleteSchool,
  type SchoolRow,
} from "../features/schools/api";
import {
  fetchStaffForSchool,
  inviteStaff,
  deactivateStaff,
  reactivateStaff,
  deleteStaffMember,
  DeactivationBlockedError,
  STAFF_ROLES,
  ROLE_LABELS,
  type StaffMember,
  type StaffRole,
} from "../features/staff/api";
import {
  fetchFeeSchedule,
  setTermFee,
  fetchSchoolInvoices,
  ensureTermSubscriptionInvoice,
  type TermFee,
  type SubscriptionInvoice,
} from "../features/subscriptions/api";
import InvoiceRow from "../components/InvoiceRow";

export default function SchoolDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
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
  const [inviteRole, setInviteRole] = useState<StaffRole>("class_teacher");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [blockedReasons, setBlockedReasons] = useState<{ id: string; reasons: string[] } | null>(null);
  const [staffNotice, setStaffNotice] = useState<string | null>(null);

  const [feeSchedule, setFeeSchedule] = useState<TermFee[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [feeNotice, setFeeNotice] = useState<string | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [s, st] = await Promise.all([fetchSchool(id), fetchStaffForSchool(id)]);
      if (!s) {
        setError("School not found.");
        return;
      }
      setSchool(s);
      setStaff(st);
      setName(s.name);
      setContactEmail(s.contact_email ?? "");
      setFeeSchedule(await fetchFeeSchedule(id));
      // Creates the current term's invoice if a rate is set for that
      // term number and none exists yet (e.g. the school just rolled
      // over to a new term) -- never touches an existing one, that's
      // setTermFee's job.
      await ensureTermSubscriptionInvoice(id);
      setInvoices(await fetchSchoolInvoices(id));
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

  async function handleSetTermFee(termNumber: number, amount: number) {
    if (!id) return;
    setFeeNotice(null);
    setFeeError(null);
    try {
      const result = await setTermFee(id, termNumber, amount);
      setFeeSchedule(await fetchFeeSchedule(id));
      setInvoices(await fetchSchoolInvoices(id));

      if (result.noCurrentTerm) {
        setFeeNotice(
          `Term ${termNumber} rate saved. No current term is set for this school yet, so no invoice was created — one will appear automatically once a term is marked current.`
        );
      } else if (result.invoiceLocked) {
        setFeeNotice(
          `Term ${termNumber} rate saved for future terms. This term's invoice already has a payment recorded, so it wasn't changed.`
        );
      } else if (result.invoiceCreated) {
        setFeeNotice(`Term ${termNumber} rate saved and an invoice was created for the current term.`);
      } else if (result.invoiceSynced) {
        setFeeNotice(`Term ${termNumber} rate saved and the current term's invoice was updated to match.`);
      }
    } catch (e) {
      setFeeError(e instanceof Error ? e.message : "Failed to save rate");
      throw e;
    }
  }

  async function handleInviteStaff() {
    if (!id || !inviteName.trim() || !inviteEmail.trim()) return;
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      await inviteStaff(id, inviteName.trim(), inviteEmail.trim(), inviteRole);
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("class_teacher");
      await load();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to invite staff member");
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleDeactivateStaff(staffId: string) {
    setProcessingId(staffId);
    setError(null);
    setBlockedReasons(null);
    setStaffNotice(null);
    try {
      await deactivateStaff(staffId);
      setStaffNotice("Staff member deactivated.");
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

  async function handleReactivateStaff(staffId: string) {
    setProcessingId(staffId);
    setError(null);
    setStaffNotice(null);
    try {
      await reactivateStaff(staffId);
      setStaffNotice("Staff member reactivated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reactivate staff member");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteStaff(staffId: string, fullName: string) {
    if (!window.confirm(`Permanently delete ${fullName}? This cannot be undone.`)) return;
    setProcessingId(staffId);
    setError(null);
    setStaffNotice(null);
    try {
      await deleteStaffMember(staffId);
      setStaffNotice("Staff member deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete staff member");
    } finally {
      setProcessingId(null);
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
        <h2 className="font-display font-bold text-slate-100">Subscription</h2>
        <p className="font-ui text-xs text-slate-500">
          Set a rate for each term. Saving a term's rate applies immediately if that's the school's current term
          (and it hasn't been paid for yet) — otherwise it just applies whenever that term is next current.
        </p>
        <div className="space-y-2">
          {feeSchedule.map((tf) => (
            <TermFeeRow key={tf.term_number} termFee={tf} onSave={(amount) => handleSetTermFee(tf.term_number, amount)} />
          ))}
        </div>
        {feeError && <p className="font-ui text-xs text-error">{feeError}</p>}
        {feeNotice && <p className="font-ui text-xs text-amber-400">{feeNotice}</p>}

        {invoices.length > 0 && (
          <div className="pt-2 border-t border-slate-800">
            <h3 className="font-ui text-xs text-slate-400 uppercase tracking-wide mb-2">Invoice History</h3>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} onChanged={async () => setInvoices(await fetchSchoolInvoices(id!))} />
              ))}
            </div>
          </div>
        )}
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
          <h2 className="font-display font-bold text-slate-100">Staff</h2>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1 font-ui text-xs text-amber-400 hover:underline"
          >
            <UserPlus size={14} /> Invite Staff
          </button>
        </div>

        {staffNotice && <p className="font-ui text-xs text-success">{staffNotice}</p>}

        {staff.length === 0 ? (
          <p className="font-ui text-xs text-slate-400">
            No staff yet — invite a School Admin or teacher to get this school started.
          </p>
        ) : (
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="bg-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body text-sm text-slate-100">{s.full_name}</span>
                    <span className="font-ui text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                      {ROLE_LABELS[s.role]}
                    </span>
                    {!s.is_active && (
                      <span className="font-ui text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                        Deactivated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {s.is_active ? (
                      <button
                        onClick={() => handleDeactivateStaff(s.id)}
                        disabled={processingId === s.id}
                        className="px-3 py-1.5 rounded-lg bg-error/10 text-error font-ui text-xs disabled:opacity-50"
                      >
                        {processingId === s.id ? "..." : "Deactivate"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivateStaff(s.id)}
                        disabled={processingId === s.id}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-ui text-xs font-semibold disabled:opacity-50"
                      >
                        {processingId === s.id ? "..." : "Reactivate"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteStaff(s.id, s.full_name)}
                      disabled={processingId === s.id}
                      className="px-3 py-1.5 rounded-lg border border-error/40 text-error font-ui text-xs disabled:opacity-50"
                    >
                      {processingId === s.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>

                {blockedReasons?.id === s.id && (
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
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as StaffRole)}
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
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
                onClick={handleInviteStaff}
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

function TermFeeRow({ termFee, onSave }: { termFee: TermFee; onSave: (amount: number) => Promise<void> }) {
  const isSet = termFee.amount !== null;
  const [editing, setEditing] = useState(!isSet);
  const [value, setValue] = useState(termFee.amount !== null ? String(termFee.amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const amount = Number(value);
    if (value.trim() === "" || Number.isNaN(amount) || amount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(amount);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
      <span className="font-body text-sm text-slate-100">Term {termFee.term_number}</span>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Amount"
            className="w-28 p-1.5 rounded bg-slate-700 border border-slate-600 text-slate-100 font-body text-sm"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-ui text-xs font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Set"}
          </button>
          {isSet && (
            <button
              onClick={() => {
                setEditing(false);
                setValue(String(termFee.amount));
                setError(null);
              }}
              className="font-ui text-xs text-slate-400 hover:underline"
            >
              Cancel
            </button>
          )}
          {error && <p className="font-ui text-xs text-error">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-ui text-sm px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 font-semibold">
            ₦{termFee.amount!.toLocaleString()}
          </span>
          <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-amber-400" aria-label="Edit rate">
            <Pencil size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
