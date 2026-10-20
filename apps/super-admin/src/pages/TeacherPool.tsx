import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Search, UserPlus } from "lucide-react";
import {
  fetchPoolTeachers,
  addPoolTeacher,
  assignPoolTeacher,
  unassignPoolTeacher,
  setPoolTeacherInactive,
  deletePoolTeacher,
  fetchOpenRequests,
  dismissRequest,
  type TeacherRequest,
  type PoolTeacher,
  type PoolStatus,
} from "../features/teacherPool/api";
import { fetchSchools, type SchoolRow } from "../features/schools/api";
import { getFriendlyErrorMessage } from "@natm/supabase";

const STATUS_LABELS: Record<PoolStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  inactive: "Inactive",
};

const STATUS_STYLES: Record<PoolStatus, string> = {
  available: "bg-success/10 text-success",
  assigned: "bg-amber-500/10 text-amber-400",
  inactive: "bg-slate-700 text-slate-400",
};

export default function TeacherPool() {
  const [teachers, setTeachers] = useState<PoolTeacher[]>([]);
  const [families, setFamilies] = useState<SchoolRow[]>([]);
  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [fulfilling, setFulfilling] = useState<TeacherRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PoolStatus | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [assigning, setAssigning] = useState<PoolTeacher | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function load() {
    try {
      const [t, schools, reqs] = await Promise.all([fetchPoolTeachers(), fetchSchools(), fetchOpenRequests()]);
      setTeachers(t);
      setRequests(reqs);
      setFamilies(schools.filter((s) => s.school_type === "homeschool" && s.is_active));
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to load the teacher pool"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPoolTeachers(), fetchSchools(), fetchOpenRequests()])
      .then(([t, schools, reqs]) => {
        if (cancelled) return;
        setTeachers(t);
        setRequests(reqs);
        setFamilies(schools.filter((s) => s.school_type === "homeschool" && s.is_active));
      })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyErrorMessage(e, "Failed to load the teacher pool"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      teachers.filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        const q = search.trim().toLowerCase();
        if (q && !t.full_name.toLowerCase().includes(q) && !t.email.toLowerCase().includes(q)) return false;
        return true;
      }),
    [teachers, search, statusFilter]
  );

  async function run(id: string, fn: () => Promise<void>, ok: string, fallback: string) {
    setProcessingId(id);
    setError(null);
    setSuccessMessage(null);
    try {
      await fn();
      setSuccessMessage(ok);
      await load();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, fallback));
    } finally {
      setProcessingId(null);
    }
  }

  const counts = {
    available: teachers.filter((t) => t.status === "available").length,
    assigned: teachers.filter((t) => t.status === "assigned").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-100">Teacher Pool</h1>
          <p className="font-body text-sm text-slate-400 mt-1">
            Vetted NATM teachers you can assign to a homeschool family. {counts.available} available,{" "}
            {counts.assigned} assigned.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold"
        >
          <UserPlus size={16} /> Add Teacher
        </button>
      </div>

      {requests.length > 0 && (
        <section className="space-y-2" aria-label="Open teacher requests">
          <h2 className="font-display text-base font-bold text-slate-100">
            Open requests <span className="font-ui text-xs text-amber-400">({requests.length})</span>
          </h2>
          {requests.map((r) => (
            <div
              key={r.id}
              data-testid="request-row"
              className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/schools/${r.school_id}`}
                    className="font-display text-slate-100 hover:text-amber-400"
                  >
                    {r.school_name}
                  </Link>
                  {r.requester_name && (
                    <span className="font-ui text-xs text-slate-400">requested by {r.requester_name}</span>
                  )}
                  <span className="font-ui text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFulfilling(r)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-ui text-xs font-semibold"
                  >
                    Assign a teacher
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Dismiss ${r.school_name}'s request?`)) return;
                      void run(r.id, () => dismissRequest(r.id), "Request dismissed.", "Failed to dismiss request");
                    }}
                    disabled={processingId === r.id}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-ui text-xs disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 font-body text-sm">
                <RequestField label="Children" value={r.children_info} />
                <RequestField label="Preferred start" value={r.preferred_start_date} />
                <RequestField label="Schedule" value={r.schedule} />
                <RequestField label="Location" value={r.location} />
                <RequestField label="Support needs" value={r.special_needs} />
                <RequestField label="Notes" value={r.notes} />
              </dl>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-body text-sm placeholder:text-slate-500 w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PoolStatus | "all")}
          aria-label="Status"
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-ui text-sm"
        >
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="assigned">Assigned</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}
      {successMessage && <p className="font-ui text-sm text-success">{successMessage}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <GraduationCap className="mx-auto text-slate-600 mb-2" size={28} />
          <p className="font-ui text-sm text-slate-400">
            {teachers.length === 0 ? "The pool is empty — add the first teacher." : "No teachers match these filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div
              key={t.id}
              data-testid="pool-row"
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-slate-100">{t.full_name}</span>
                  <span className={`font-ui text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[t.status]}`}>
                    {STATUS_LABELS[t.status]}
                  </span>
                  {t.status === "assigned" && t.assigned_school_id && (
                    <Link
                      to={`/schools/${t.assigned_school_id}`}
                      className="font-ui text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 hover:text-amber-400"
                    >
                      {t.assigned_school_name ?? "Family"}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {t.status === "available" && (
                    <button
                      onClick={() => setAssigning(t)}
                      disabled={processingId === t.id}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-ui text-xs font-semibold disabled:opacity-50"
                    >
                      Assign to family
                    </button>
                  )}
                  {t.status === "assigned" && (
                    <button
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Unassign ${t.full_name} from ${t.assigned_school_name ?? "this family"}? They will lose access to the family until assigned again.`
                          )
                        )
                          return;
                        void run(t.id, () => unassignPoolTeacher(t.id), "Teacher unassigned.", "Failed to unassign teacher");
                      }}
                      disabled={processingId === t.id}
                      className="px-3 py-1.5 rounded-lg bg-error/10 text-error font-ui text-xs disabled:opacity-50"
                    >
                      {processingId === t.id ? "..." : "Unassign"}
                    </button>
                  )}
                  {t.status !== "assigned" && (
                    <button
                      onClick={() =>
                        run(
                          t.id,
                          () => setPoolTeacherInactive(t.id, t.status === "available"),
                          t.status === "available" ? "Teacher set inactive." : "Teacher is available again.",
                          "Failed to update teacher"
                        )
                      }
                      disabled={processingId === t.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-ui text-xs disabled:opacity-50"
                    >
                      {t.status === "available" ? "Set inactive" : "Make available"}
                    </button>
                  )}
                  {t.status !== "assigned" && (
                    <button
                      onClick={() => {
                        if (!window.confirm(`Remove ${t.full_name} from the pool?`)) return;
                        void run(t.id, () => deletePoolTeacher(t.id), "Teacher removed.", "Failed to remove teacher");
                      }}
                      disabled={processingId === t.id}
                      className="px-3 py-1.5 rounded-lg border border-error/40 text-error font-ui text-xs disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <p className="font-ui text-xs text-slate-400">
                {t.email}
                {t.phone ? ` · ${t.phone}` : ""}
              </p>
              {t.qualifications && <p className="font-body text-sm text-slate-300">{t.qualifications}</p>}
              {t.notes && <p className="font-body text-xs text-slate-500">{t.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddTeacherModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            setSuccessMessage("Teacher added to the pool.");
            load();
          }}
        />
      )}
      {fulfilling && (
        <FulfilModal
          request={fulfilling}
          teachers={teachers.filter((t) => t.status === "available")}
          onClose={() => setFulfilling(null)}
          onAssigned={() => {
            setFulfilling(null);
            setSuccessMessage("Teacher assigned and the request is marked matched.");
            load();
          }}
        />
      )}
      {assigning && (
        <AssignModal
          teacher={assigning}
          families={families}
          onClose={() => setAssigning(null)}
          onAssigned={() => {
            setAssigning(null);
            setSuccessMessage("Teacher assigned. They'll get an invite email if this is their first family.");
            load();
          }}
        />
      )}
    </div>
  );
}

function AddTeacherModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!fullName.trim() || !email.trim()) {
      setError("Full name and email are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addPoolTeacher({ full_name: fullName.trim(), email, phone, qualifications, notes });
      onAdded();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to add teacher"));
      setSubmitting(false);
    }
  }

  const input = "mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm";
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-100">Add Teacher to Pool</h2>
        <div className="space-y-3">
          <div>
            <label className="font-ui text-xs text-slate-400" htmlFor="pool-name">Full name</label>
            <input id="pool-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} autoFocus />
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400" htmlFor="pool-email">Email</label>
            <input id="pool-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400" htmlFor="pool-phone">Phone (optional)</label>
            <input id="pool-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400" htmlFor="pool-quals">Qualifications and NATM training (optional)</label>
            <textarea id="pool-quals" rows={2} value={qualifications} onChange={(e) => setQualifications(e.target.value)} className={input} />
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400" htmlFor="pool-notes">Internal notes (optional)</label>
            <textarea id="pool-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
          </div>
        </div>
        {error && <p className="font-ui text-xs text-error">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} disabled={submitting} className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Adding..." : "Add Teacher"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignModal({
  teacher,
  families,
  onClose,
  onAssigned,
}: {
  teacher: PoolTeacher;
  families: SchoolRow[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!schoolId) {
      setError("Choose a family first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await assignPoolTeacher(teacher.id, schoolId);
      onAssigned();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to assign teacher"));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-100">Assign {teacher.full_name}</h2>
        <p className="font-body text-sm text-slate-400">
          They become the homeschool teacher for the family you choose, and can sign in to run it.
        </p>
        <div>
          <label className="font-ui text-xs text-slate-400" htmlFor="assign-family">Homeschool family</label>
          <select
            id="assign-family"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          >
            <option value="">{families.length === 0 ? "No homeschool families yet" : "Select a family..."}</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="font-ui text-xs text-error">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} disabled={submitting} className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !schoolId}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="inline font-ui text-xs text-slate-500">{label}: </dt>
      <dd className="inline text-slate-300">{value}</dd>
    </div>
  );
}

function FulfilModal({
  request,
  teachers,
  onClose,
  onAssigned,
}: {
  request: TeacherRequest;
  teachers: PoolTeacher[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!teacherId) {
      setError("Choose a teacher first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await assignPoolTeacher(teacherId, request.school_id);
      onAssigned();
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to assign teacher"));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-100">Assign a teacher to {request.school_name}</h2>
        <div>
          <label className="font-ui text-xs text-slate-400" htmlFor="fulfil-teacher">Available teacher</label>
          <select
            id="fulfil-teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          >
            <option value="">{teachers.length === 0 ? "No available teachers in the pool" : "Select a teacher..."}</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
                {t.qualifications ? ` — ${t.qualifications}` : ""}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="font-ui text-xs text-error">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} disabled={submitting} className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !teacherId}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
