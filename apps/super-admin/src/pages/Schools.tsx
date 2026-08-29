import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Building2, Search } from "lucide-react";
import { fetchSchools, createSchool, type SchoolRow } from "../features/schools/api";

export default function Schools() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setSchools(await fetchSchools());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = schools.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-100">Schools</h1>
          <p className="font-body text-sm text-slate-400 mt-1">Every school on the platform.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold"
        >
          <Plus size={16} /> New School
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search schools..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-body text-sm placeholder:text-slate-500"
        />
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Building2 className="mx-auto text-slate-600 mb-2" size={28} />
          <p className="font-ui text-sm text-slate-400">
            {schools.length === 0 ? "No schools yet — create the first one." : "No schools match that search."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to={`/schools/${s.id}`}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Building2 size={16} className="text-amber-500" />
                </div>
                <span
                  className={`font-ui text-xs px-2 py-0.5 rounded-full ${
                    s.is_active ? "bg-success/10 text-success" : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {s.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <h3 className="font-display font-bold text-slate-100 mb-1">{s.name}</h3>
              <p className="font-ui text-xs text-slate-400">
                {s.student_count} student{s.student_count === 1 ? "" : "s"} · {s.staff_count} staff
              </p>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSchoolModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateSchoolModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("School name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createSchool(name.trim(), contactEmail.trim(), adminName.trim(), adminEmail.trim());
      if (result.admin_invite_error) {
        // The school itself was created successfully -- this is a
        // partial-success case, not a failure, so it closes the modal
        // and refreshes the list rather than leaving the form stuck.
        setNotice(result.admin_invite_error);
        setTimeout(onCreated, 2000);
      } else {
        onCreated();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create school");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-100">New School</h2>

        <div className="space-y-3">
          <div>
            <label className="font-ui text-xs text-slate-400">School name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="font-ui text-xs text-slate-400">Contact email (optional)</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
            />
          </div>

          <div className="pt-2 border-t border-slate-800">
            <p className="font-ui text-xs text-slate-400 mb-2">
              First School Admin (optional — can be added later from the school's page)
            </p>
            <div className="space-y-3">
              <input
                placeholder="Admin's full name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
              />
              <input
                type="email"
                placeholder="Admin's email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {error && <p className="font-ui text-xs text-error">{error}</p>}
        {notice && <p className="font-ui text-xs text-warning">{notice}</p>}

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
            {submitting ? "Creating..." : "Create School"}
          </button>
        </div>
      </div>
    </div>
  );
}
