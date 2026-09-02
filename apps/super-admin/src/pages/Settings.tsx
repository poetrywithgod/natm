import { useEffect, useState } from "react";
import { Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { fetchPlatformSettings, updatePlatformSettings, type PlatformSettings } from "../features/settings/api";

export default function Settings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [term1, setTerm1] = useState("");
  const [term2, setTerm2] = useState("");
  const [term3, setTerm3] = useState("");
  const [feesSaving, setFeesSaving] = useState(false);
  const [feesSaved, setFeesSaved] = useState(false);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceSaved, setMaintenanceSaved] = useState(false);

  useEffect(() => {
    fetchPlatformSettings()
      .then((s) => {
        setSettings(s);
        setTerm1(s.default_term_1_fee != null ? String(s.default_term_1_fee) : "");
        setTerm2(s.default_term_2_fee != null ? String(s.default_term_2_fee) : "");
        setTerm3(s.default_term_3_fee != null ? String(s.default_term_3_fee) : "");
        setMaintenanceMode(s.maintenance_mode);
        setMaintenanceMessage(s.maintenance_message ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  function parseFeeInput(v: string): number | null {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isNaN(n) || n < 0 ? null : n;
  }

  async function handleSaveFees() {
    setFeesSaving(true);
    setFeesSaved(false);
    setError(null);
    try {
      await updatePlatformSettings({
        default_term_1_fee: parseFeeInput(term1),
        default_term_2_fee: parseFeeInput(term2),
        default_term_3_fee: parseFeeInput(term3),
      });
      setFeesSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save default fees");
    } finally {
      setFeesSaving(false);
    }
  }

  async function handleSaveMaintenance() {
    setMaintenanceSaving(true);
    setMaintenanceSaved(false);
    setError(null);
    try {
      await updatePlatformSettings({
        maintenance_mode: maintenanceMode,
        maintenance_message: maintenanceMessage.trim() || null,
      });
      setMaintenanceSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save maintenance settings");
    } finally {
      setMaintenanceSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <p className="font-ui text-sm text-error">{error ?? "Settings could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100 flex items-center gap-2">
          <SettingsIcon size={22} className="text-amber-500" /> Settings
        </h1>
        <p className="font-body text-sm text-slate-400 mt-1">Platform-wide defaults and controls.</p>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-bold text-slate-100">Default Subscription Fees</h2>
        <p className="font-ui text-xs text-slate-400">
          Pre-fills a new school's Term 1/2/3 rate card when it's created, so you're not re-entering the same numbers
          every time. Leave a term blank to skip it — new schools still start with whatever terms you do set here,
          editable per school afterward.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Term 1", value: term1, set: setTerm1 },
            { label: "Term 2", value: term2, set: setTerm2 },
            { label: "Term 3", value: term3, set: setTerm3 },
          ].map((t) => (
            <div key={t.label}>
              <label className="font-ui text-xs text-slate-400">{t.label} (₦)</label>
              <input
                type="number"
                min={0}
                value={t.value}
                onChange={(e) => {
                  t.set(e.target.value);
                  setFeesSaved(false);
                }}
                className="mt-1 w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleSaveFees}
          disabled={feesSaving}
          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
        >
          {feesSaving ? "Saving..." : "Save Defaults"}
        </button>
        {feesSaved && <p className="font-ui text-xs text-success">Saved.</p>}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-bold text-slate-100 flex items-center gap-2">
          <AlertTriangle size={16} className="text-warning" /> Maintenance Mode
        </h2>
        <p className="font-ui text-xs text-slate-400">
          Shows a banner across the Staff and Student/Parent apps. It's informational only — it does not block sign-in
          or access, so turning this on won't lock anyone (including you) out mid-incident.
        </p>
        <label className="flex items-center gap-2 font-ui text-sm text-slate-100 cursor-pointer">
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={(e) => {
              setMaintenanceMode(e.target.checked);
              setMaintenanceSaved(false);
            }}
          />
          Maintenance banner is {maintenanceMode ? "ON" : "OFF"}
        </label>
        <textarea
          value={maintenanceMessage}
          onChange={(e) => {
            setMaintenanceMessage(e.target.value);
            setMaintenanceSaved(false);
          }}
          rows={2}
          placeholder="e.g. Brief downtime expected 10–11pm WAT for a database upgrade."
          className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
        />
        <button
          onClick={handleSaveMaintenance}
          disabled={maintenanceSaving}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm disabled:opacity-60"
        >
          {maintenanceSaving ? "Saving..." : "Save"}
        </button>
        {maintenanceSaved && <p className="font-ui text-xs text-success">Saved.</p>}
      </div>
    </div>
  );
}
