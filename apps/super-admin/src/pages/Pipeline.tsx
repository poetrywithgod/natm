import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Target, Plus, Trash2, ArrowRightCircle, ExternalLink } from "lucide-react";
import {
  fetchProspects,
  createProspect,
  updateProspect,
  deleteProspect,
  convertProspectToSchool,
  PROSPECT_STAGES,
  STAGE_LABELS,
  type Prospect,
  type ProspectStage,
} from "../features/prospects/api";

const STAGE_BADGE: Record<ProspectStage, string> = {
  new: "bg-slate-700 text-slate-300",
  contacted: "bg-amber-500/10 text-amber-400",
  demo_scheduled: "bg-amber-500/10 text-amber-400",
  negotiating: "bg-warning/10 text-warning",
  won: "bg-success/10 text-success",
  lost: "bg-error/10 text-error",
};

export default function Pipeline() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<ProspectStage | "all">("all");
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setProspects(await fetchProspects());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prospects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<ProspectStage, number> = { new: 0, contacted: 0, demo_scheduled: 0, negotiating: 0, won: 0, lost: 0 };
    for (const p of prospects) c[p.stage] += 1;
    return c;
  }, [prospects]);

  const visible = stageFilter === "all" ? prospects : prospects.filter((p) => p.stage === stageFilter);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <Target size={22} className="text-amber-500" /> Pipeline
          </h1>
          <p className="font-body text-sm text-slate-400 mt-1">Prospective schools, before they become real tenants.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold"
        >
          <Plus size={16} /> Add Prospect
        </button>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStageFilter("all")}
          className={`px-3 py-1.5 rounded-full font-ui text-xs ${
            stageFilter === "all" ? "bg-amber-500 text-slate-950 font-semibold" : "bg-slate-800 text-slate-300"
          }`}
        >
          All ({prospects.length})
        </button>
        {PROSPECT_STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className={`px-3 py-1.5 rounded-full font-ui text-xs ${
              stageFilter === s ? "bg-amber-500 text-slate-950 font-semibold" : "bg-slate-800 text-slate-300"
            }`}
          >
            {STAGE_LABELS[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : visible.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Target className="mx-auto text-slate-600 mb-2" size={28} />
          <p className="font-ui text-sm text-slate-400">
            {prospects.length === 0 ? "No prospects yet — add the first one." : "No prospects in this stage."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <ProspectRow key={p.id} prospect={p} onChanged={load} />
          ))}
        </div>
      )}

      {showAdd && <AddProspectModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function ProspectRow({ prospect, onChanged }: { prospect: Prospect; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(prospect.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStageChange(stage: ProspectStage) {
    setSaving(true);
    setError(null);
    try {
      await updateProspect(prospect.id, { stage });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update stage");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotes() {
    setSaving(true);
    setError(null);
    try {
      await updateProspect(prospect.id, { notes: notes.trim() || null });
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${prospect.school_name}" from the pipeline?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProspect(prospect.id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setSaving(false);
    }
  }

  async function handleConvert() {
    if (!window.confirm(`Create a real school for "${prospect.school_name}" and invite ${prospect.contact_name || "the contact"} as School Admin?`)) return;
    setConverting(true);
    setError(null);
    try {
      await convertProspectToSchool(prospect);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to convert");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-slate-100">{prospect.school_name}</span>
            <span className={`font-ui text-xs px-2 py-0.5 rounded-full ${STAGE_BADGE[prospect.stage]}`}>
              {STAGE_LABELS[prospect.stage]}
            </span>
          </div>
          <p className="font-ui text-xs text-slate-400 mt-0.5">
            {[prospect.contact_name, prospect.contact_email, prospect.contact_phone].filter(Boolean).join(" · ") || "No contact info"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={prospect.stage}
            onChange={(e) => handleStageChange(e.target.value as ProspectStage)}
            disabled={saving || !!prospect.converted_school_id}
            className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-ui text-xs disabled:opacity-50"
          >
            {PROSPECT_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          {prospect.converted_school_id ? (
            <Link
              to={`/schools/${prospect.converted_school_id}`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-ui text-xs hover:bg-slate-700"
            >
              <ExternalLink size={12} /> View School
            </Link>
          ) : prospect.stage === "won" ? (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-ui text-xs font-semibold disabled:opacity-50"
            >
              <ArrowRightCircle size={12} />
              {converting ? "Converting..." : "Convert to School"}
            </button>
          ) : null}
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-slate-400 hover:text-error"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setNotes(prospect.notes ?? "");
              }}
              className="font-ui text-xs text-slate-400 hover:underline"
            >
              Cancel
            </button>
            <button onClick={handleSaveNotes} disabled={saving} className="font-ui text-xs text-amber-400 hover:underline">
              {saving ? "Saving..." : "Save notes"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-left w-full">
          <p className="font-body text-sm text-slate-400">
            {prospect.notes || <span className="italic text-slate-600">Add notes...</span>}
          </p>
        </button>
      )}

      {error && <p className="font-ui text-xs text-error">{error}</p>}
    </div>
  );
}

function AddProspectModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [schoolName, setSchoolName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!schoolName.trim()) {
      setError("School name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createProspect({
        school_name: schoolName.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
      });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add prospect");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-100">Add Prospect</h2>
        <div className="space-y-3">
          <div>
            <label className="font-ui text-xs text-slate-400">School name</label>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400">Contact name</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
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
          <div>
            <label className="font-ui text-xs text-slate-400">Contact phone</label>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
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
            {submitting ? "Adding..." : "Add Prospect"}
          </button>
        </div>
      </div>
    </div>
  );
}
