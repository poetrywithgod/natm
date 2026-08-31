import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Building2, Users, GraduationCap, Trash2, UserPlus, Pencil, ChevronDown, ChevronRight } from "lucide-react";
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
import {
  fetchSubscriptionFee,
  saveSubscriptionFee,
  fetchSchoolInvoices,
  ensureTermSubscriptionInvoice,
  updateInvoiceAmount,
  deleteInvoice,
  fetchInvoicePayments,
  type SubscriptionInvoice,
  type SubscriptionPayment,
} from "../features/subscriptions/api";

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

  const [subscriptionFee, setSubscriptionFeeState] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);

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
      const fee = await fetchSubscriptionFee(id);
      setSubscriptionFeeState(fee === null ? "" : String(fee));
      // Creates the current term's invoice if the fee is set and none
      // exists yet (e.g. the school just rolled over to a new term) --
      // never touches an existing one, that's saveSubscriptionFee's job.
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

  async function handleSaveFee() {
    if (!id) return;
    const parsed = subscriptionFee.trim() === "" ? null : Number(subscriptionFee);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setFeeError("Enter a valid amount.");
      return;
    }
    setSavingFee(true);
    setFeeError(null);
    try {
      await saveSubscriptionFee(id, parsed);
      setInvoices(await fetchSchoolInvoices(id));
    } catch (e) {
      setFeeError(e instanceof Error ? e.message : "Failed to save fee");
    } finally {
      setSavingFee(false);
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
        <h2 className="font-display font-bold text-slate-100">Subscription</h2>
        <div>
          <label className="font-ui text-xs text-slate-400">Termly fee (₦)</label>
          <div className="flex gap-2 mt-1">
            <input
              type="number"
              min={0}
              value={subscriptionFee}
              onChange={(e) => setSubscriptionFeeState(e.target.value)}
              placeholder="Not set"
              className="flex-1 p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
            />
            <button
              onClick={handleSaveFee}
              disabled={savingFee}
              className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
            >
              {savingFee ? "Saving..." : "Save"}
            </button>
          </div>
          {feeError && <p className="font-ui text-xs text-error mt-1">{feeError}</p>}
          <p className="font-ui text-xs text-slate-500 mt-1">
            Saving updates the current term's invoice too, as long as it hasn't received any payment yet. Once
            paid, changes apply from the next term.
          </p>
        </div>

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

function InvoiceRow({ invoice, onChanged }: { invoice: SubscriptionInvoice; onChanged: () => Promise<void> }) {
  const balance = invoice.amount_due - invoice.amount_paid;
  const isPaid = balance <= 0.01;
  const isLocked = invoice.amount_paid > 0; // any payment at all, partial or full

  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(String(invoice.amount_due));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPayments, setShowPayments] = useState(false);
  const [payments, setPayments] = useState<SubscriptionPayment[] | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);

  async function handleSaveEdit() {
    const amount = Number(editAmount);
    if (Number.isNaN(amount) || amount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateInvoiceAmount(invoice.id, amount);
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the ${invoice.term_label} invoice? This can't be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteInvoice(invoice.id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete invoice");
      setSaving(false);
    }
  }

  async function togglePayments() {
    if (!showPayments && payments === null) {
      setLoadingPayments(true);
      try {
        setPayments(await fetchInvoicePayments(invoice.id));
      } catch {
        setPayments([]);
      } finally {
        setLoadingPayments(false);
      }
    }
    setShowPayments((v) => !v);
  }

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body text-sm text-slate-100">{invoice.term_label}</p>
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={0}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-28 p-1 rounded bg-slate-700 border border-slate-600 text-slate-100 font-body text-xs"
              />
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="font-ui text-xs text-amber-400 hover:underline disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditAmount(String(invoice.amount_due));
                  setError(null);
                }}
                className="font-ui text-xs text-slate-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="font-ui text-xs text-slate-400">
              ₦{invoice.amount_due.toLocaleString()} due · ₦{invoice.amount_paid.toLocaleString()} paid
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-ui text-xs px-2 py-0.5 rounded-full ${
              isPaid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}
          >
            {isPaid ? "Paid" : "Outstanding"}
          </span>
          {!isLocked && !editing && (
            <>
              <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-amber-400" aria-label="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={handleDelete} disabled={saving} className="text-slate-400 hover:text-error" aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="font-ui text-xs text-error">{error}</p>}
      {isLocked && (
        <button
          onClick={togglePayments}
          className="flex items-center gap-1 font-ui text-xs text-slate-400 hover:text-slate-100"
        >
          {showPayments ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Payment history
        </button>
      )}
      {showPayments && (
        <div className="pl-4 space-y-1 border-l border-slate-700">
          {loadingPayments ? (
            <p className="font-ui text-xs text-slate-500">Loading...</p>
          ) : payments && payments.length > 0 ? (
            payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between font-ui text-xs text-slate-400">
                <span>
                  ₦{p.amount.toLocaleString()} · {p.status}
                  {p.rrr ? ` · RRR ${p.rrr}` : ""}
                </span>
                <span>{new Date(p.created_at).toLocaleString()}</span>
              </div>
            ))
          ) : (
            <p className="font-ui text-xs text-slate-500">No payment attempts recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}
