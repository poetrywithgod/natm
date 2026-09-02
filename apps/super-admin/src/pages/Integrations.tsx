import { useEffect, useState } from "react";
import { Plug, Pencil, RefreshCw } from "lucide-react";
import {
  fetchIntegrations,
  updateIntegration,
  testAnthropicConnection,
  type Integration,
  type IntegrationStatus,
} from "../features/integrations/api";

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_configured: "Not Configured",
  blocked: "Blocked",
  configured: "Configured",
  working: "Working",
};

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  not_configured: "bg-slate-700 text-slate-300",
  blocked: "bg-error/10 text-error",
  configured: "bg-warning/10 text-warning",
  working: "bg-success/10 text-success",
};

const STATUS_OPTIONS: IntegrationStatus[] = ["not_configured", "blocked", "configured", "working"];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setIntegrations(await fetchIntegrations());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100">Integrations</h1>
        <p className="font-body text-sm text-slate-400 mt-1">
          External services this platform depends on, and where each one stands.
        </p>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : (
        <div className="space-y-3">
          {integrations.map((i) => (
            <IntegrationCard key={i.id} integration={i} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({ integration, onChanged }: { integration: Integration; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<IntegrationStatus>(integration.status);
  const [notes, setNotes] = useState(integration.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateIntegration(integration.id, status, notes);
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    try {
      await testAnthropicConnection();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Plug size={16} className="text-amber-500" />
          <h2 className="font-display font-bold text-slate-100">{integration.label}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-ui text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[integration.status]}`}>
            {STATUS_LABELS[integration.status]}
          </span>
          {integration.id === "anthropic" && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-ui text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCw size={12} className={testing ? "animate-spin" : ""} />
              {testing ? "Testing..." : "Test Connection"}
            </button>
          )}
          {!editing && (
            <button
              onClick={() => {
                setStatus(integration.status);
                setNotes(integration.notes ?? "");
                setEditing(true);
              }}
              className="text-slate-400 hover:text-amber-400"
              aria-label="Edit"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as IntegrationStatus)}
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
            placeholder="What's blocking it, or what's next..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 font-ui text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        integration.notes && <p className="font-body text-sm text-slate-400">{integration.notes}</p>
      )}

      {error && <p className="font-ui text-xs text-error">{error}</p>}

      {integration.last_checked_at && (
        <p className="font-ui text-xs text-slate-500">
          Last checked {new Date(integration.last_checked_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
