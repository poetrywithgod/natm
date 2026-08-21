import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchOrCreateForm2Draft,
  saveForm2Draft,
  submitForm2,
  type Form2Draft,
} from "../features/observation/api";
import {
  CONFIDENCE_OPTIONS,
  FORM_TWO_DOMAINS,
  OBSERVATION_INFO_FIELDS,
  OBSERVATION_SEGMENTS,
  SNAPSHOT_FIELDS,
} from "../features/observation/observationTypes";
import Form2DomainRenderer, {
  type Form2DomainValues,
  type Form2ParameterValue,
} from "../features/observation/Form2DomainRenderer";
import { supabase } from "../lib/supabase";

type Section = "info" | "protocol" | "domains" | "snapshot";

export default function ShadowTeacherObservation() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [draft, setDraft] = useState<Form2Draft | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("info");
  const [activeDomainIndex, setActiveDomainIndex] = useState(0);

  const [observationInfo, setObservationInfo] = useState<Record<string, unknown>>({});
  const [protocolNotes, setProtocolNotes] = useState<Record<string, unknown>>({});
  const [domains, setDomains] = useState<Form2DomainValues>({});
  const [snapshot, setSnapshot] = useState<Record<string, unknown>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentDomain = FORM_TWO_DOMAINS[activeDomainIndex];

  const completedDomains = useMemo(() => {
    return FORM_TWO_DOMAINS.filter((domain) =>
      domain.parameters.every((parameter) => {
        const value = domains[parameter.id];
        return (
          value?.functionalCapacity &&
          value?.supportIntensity &&
          value?.confidence
        );
      })
    ).length;
  }, [domains]);

  useEffect(() => {
    if (!episodeId || !profile?.school_id || !profile?.id) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchOrCreateForm2Draft(
          episodeId,
          profile.school_id,
          profile.id
        );

        if (cancelled) return;

        setDraft(result);
        setObservationInfo(result.observationInfo);
        setProtocolNotes(result.protocolNotes);

        const savedDomains = result.domains.domains;
        const savedSnapshot = result.domains.snapshot;

        setDomains(
          savedDomains && typeof savedDomains === "object"
            ? (savedDomains as Form2DomainValues)
            : {}
        );

        setSnapshot(
          savedSnapshot && typeof savedSnapshot === "object"
            ? (savedSnapshot as Record<string, unknown>)
            : {}
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Form 2");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [episodeId, profile?.id, profile?.school_id]);

  async function saveSection(
    section: "observation_info" | "protocol_notes" | "domains",
    data: Record<string, unknown>
  ) {
    if (!draft) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await saveForm2Draft(draft.form2Id, section, data);
      setMessage("Draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  function updateDomain(parameterId: string, value: Form2ParameterValue) {
    setDomains((current) => ({
      ...current,
      [parameterId]: value,
    }));
  }

  async function handleSaveDomains() {
    await saveSection("domains", {
      domains,
      snapshot,
    });
  }

  async function handleSubmit() {
    if (!draft || !episodeId || !profile?.id) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await saveForm2Draft(draft.form2Id, "observation_info", observationInfo);
      await saveForm2Draft(draft.form2Id, "protocol_notes", protocolNotes);
      await saveForm2Draft(draft.form2Id, "domains", {
        domains,
        snapshot,
      });

      await submitForm2(draft.form2Id, episodeId, profile.id);

      navigate("/shadow-teacher/students");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit Form 2");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 font-ui text-forest-100">
        Loading Form 2...
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="font-display text-xl text-forest-100">
          Form 2 unavailable
        </h1>
        <p className="font-ui text-sm text-forest-300">
          {error ?? "The observation draft could not be loaded."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      <header className="space-y-1">
        <p className="font-ui text-xs uppercase tracking-wide text-forest-500">
          NATM Assessment
        </p>
        <h1 className="font-display text-2xl text-forest-100">
          Form 2 — Observation
        </h1>
        <p className="font-ui text-sm text-forest-300">
          Structured observation of functional access, participation,
          regulation, communication, learning and independence.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["info", "Observation Info"],
            ["protocol", "Observation Protocol"],
            ["domains", "Functional Domains"],
            ["snapshot", "Observation Snapshot"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`px-3 py-2 rounded-md border font-ui text-xs font-semibold ${
              activeSection === key
                ? "bg-forest-500 border-forest-500 text-forest-950"
                : "bg-forest-950 border-forest-700 text-forest-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-error/40 bg-forest-900 px-4 py-3">
          <p className="font-ui text-sm text-error">{error}</p>
        </div>
      )}

      {message && (
        <p className="font-ui text-sm text-forest-300">{message}</p>
      )}

      {activeSection === "info" && (
        <section className="bg-forest-900 border border-forest-800 rounded-lg p-5 space-y-5">
          <div>
            <h2 className="font-display text-lg text-forest-100">
              Observation Information
            </h2>
            <p className="font-ui text-sm text-forest-300 mt-1">
              Record the basic context for this observation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OBSERVATION_INFO_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="font-ui text-xs font-semibold text-forest-300">
                  {field.label}
                </span>

                {field.type === "select" ? (
                  <select
                    value={String(observationInfo[field.key] ?? "")}
                    onChange={(event) =>
                      setObservationInfo((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100 focus:outline-none focus:border-forest-500"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={String(observationInfo[field.key] ?? "")}
                    onChange={(event) =>
                      setObservationInfo((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100 placeholder:text-forest-500 focus:outline-none focus:border-forest-500"
                  />
                )}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={() => saveSection("observation_info", observationInfo)}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Observation Info"}
          </button>
        </section>
      )}

      {activeSection === "protocol" && (
        <section className="space-y-4">
          <div className="bg-forest-900 border border-forest-800 rounded-lg p-5">
            <h2 className="font-display text-lg text-forest-100">
              Observation Protocol
            </h2>
            <p className="font-ui text-sm text-forest-300 mt-1">
              Observe naturally. Do not deliberately provoke distress or
              overload.
            </p>
          </div>

          {OBSERVATION_SEGMENTS.map((segment) => (
            <div
              key={segment.key}
              className="bg-forest-900 border border-forest-800 rounded-lg p-5 space-y-3"
            >
              <h3 className="font-ui text-sm font-semibold text-forest-100">
                {segment.label}
              </h3>

              <p className="font-ui text-sm text-forest-300">
                {segment.prompt}
              </p>

              <textarea
                rows={4}
                value={String(protocolNotes[segment.key] ?? "")}
                onChange={(event) =>
                  setProtocolNotes((current) => ({
                    ...current,
                    [segment.key]: event.target.value,
                  }))
                }
                placeholder="Record objective observations..."
                className="w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100 placeholder:text-forest-500 focus:outline-none focus:border-forest-500"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => saveSection("protocol_notes", protocolNotes)}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Protocol Notes"}
          </button>
        </section>
      )}

      {activeSection === "domains" && currentDomain && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-forest-900 border border-forest-800 rounded-lg p-4">
            <div>
              <p className="font-ui text-xs text-forest-400">
                Domain {activeDomainIndex + 1} of {FORM_TWO_DOMAINS.length}
              </p>
              <p className="font-ui text-sm text-forest-100">
                {completedDomains} of {FORM_TWO_DOMAINS.length} domains fully scored
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveDomains}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Domain Scores"}
            </button>
          </div>

          <Form2DomainRenderer
            domain={currentDomain}
            values={domains}
            onChange={updateDomain}
          />

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setActiveDomainIndex((index) => Math.max(0, index - 1))
              }
              disabled={activeDomainIndex === 0}
              className="px-4 py-2 rounded-md border border-forest-700 text-forest-200 font-ui text-sm disabled:opacity-40"
            >
              Previous Domain
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveDomainIndex((index) =>
                  Math.min(FORM_TWO_DOMAINS.length - 1, index + 1)
                )
              }
              disabled={activeDomainIndex === FORM_TWO_DOMAINS.length - 1}
              className="px-4 py-2 rounded-md bg-forest-700 text-forest-100 font-ui text-sm disabled:opacity-40"
            >
              Next Domain
            </button>
          </div>
        </section>
      )}

      {activeSection === "snapshot" && (
        <section className="bg-forest-900 border border-forest-800 rounded-lg p-5 space-y-5">
          <div>
            <h2 className="font-display text-lg text-forest-100">
              Observation Snapshot
            </h2>
            <p className="font-ui text-sm text-forest-300 mt-1">
              Summarise strengths, barriers, supports, learning entry points
              and immediate concerns.
            </p>
          </div>

          <div className="space-y-4">
            {SNAPSHOT_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="font-ui text-xs font-semibold text-forest-300">
                  {field.label}
                </span>

                {field.type === "textarea" ? (
                  <textarea
                    rows={4}
                    value={String(snapshot[field.key] ?? "")}
                    onChange={(event) =>
                      setSnapshot((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100 placeholder:text-forest-500 focus:outline-none focus:border-forest-500"
                  />
                ) : field.type === "radio" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {field.options?.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setSnapshot((current) => ({
                            ...current,
                            [field.key]: option,
                          }))
                        }
                        className={`px-3 py-2 rounded-md border font-ui text-xs ${
                          snapshot[field.key] === option
                            ? "bg-forest-500 border-forest-500 text-forest-950"
                            : "bg-forest-950 border-forest-700 text-forest-200"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    value={String(snapshot[field.key] ?? "")}
                    onChange={(event) =>
                      setSnapshot((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100 placeholder:text-forest-500 focus:outline-none focus:border-forest-500"
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveDomains}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-forest-700 text-forest-100 font-ui text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Snapshot"}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Form 2"}
            </button>
          </div>
        </section>
      )}

      <div className="bg-forest-900 border border-forest-800 rounded-lg p-4">
        <p className="font-ui text-xs text-forest-400">
          Confidence scale: {CONFIDENCE_OPTIONS.join(" / ")}. Functional
          capacity and support intensity use the 0–4 scale plus N/O where
          observation is not available.
        </p>
      </div>
    </div>
  );
}
