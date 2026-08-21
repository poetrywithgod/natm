import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchOwnStudentRecord } from "../features/profile/api";
import { getOrCreateDraftEpisode, saveFormDraft, submitForm1, type DraftEpisode } from "../features/intake/api";
import { PART_A_STEPS } from "../features/intake/formConfigA";
import { FORM_B_DOMAINS } from "../features/intake/formConfigB";
import IntakeFieldRenderer from "../components/IntakeFieldRenderer";
import DomainRenderer from "../components/DomainRenderer";

type Phase = "a" | "b";

export default function StudentIntakeForm() {
  const { profile } = useAuth();

  const [draft, setDraft] = useState<DraftEpisode | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [partBData, setPartBData] = useState<Record<string, Record<string, unknown>>>({});
  const [phase, setPhase] = useState<Phase>("a");
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!profile?.id || !profile.school_id) return;
    let cancelled = false;

    (async () => {
      try {
        const rec = await fetchOwnStudentRecord(profile.id);
        if (cancelled || !rec) return;
        setStudentId(rec.id);
        const d = await getOrCreateDraftEpisode(profile.school_id!, rec.id);
        if (cancelled) return;
        setDraft(d);
        setFormData(d.partA);
        setPartBData(d.partB as Record<string, Record<string, unknown>>);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load form");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.school_id]);

  const totalSteps = PART_A_STEPS.length + FORM_B_DOMAINS.length;
  const overallStep = phase === "a" ? stepIndex : PART_A_STEPS.length + stepIndex;
  const isFirst = phase === "a" && stepIndex === 0;
  const isLast = phase === "b" && stepIndex === FORM_B_DOMAINS.length - 1;

  function handleFieldChange(key: string, value: unknown) {
    setFormData((f) => ({ ...f, [key]: value }));
  }

  function handleDomainChange(domainId: string, value: Record<string, unknown>) {
    setPartBData((pb) => ({ ...pb, [domainId]: value }));
  }

  async function persistPartA() {
    if (!draft) return;
    await saveFormDraft(draft.form1Id, "part_a", formData);
  }

  async function persistPartB() {
    if (!draft) return;
    await saveFormDraft(draft.form1Id, "part_b", partBData);
  }

  async function handleBack() {
    if (phase === "b" && stepIndex === 0) {
      setPhase("a");
      setStepIndex(PART_A_STEPS.length - 1);
    } else {
      setStepIndex((i) => i - 1);
    }
  }

  async function handleNext() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      if (phase === "a") {
        await persistPartA();
        if (stepIndex === PART_A_STEPS.length - 1) {
          setPhase("b");
          setStepIndex(0);
        } else {
          setStepIndex((i) => i + 1);
        }
      } else {
        await persistPartB();
        setStepIndex((i) => i + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!draft || !profile?.id || !studentId) return;
    setSaving(true);
    setError(null);
    try {
      await persistPartB();
      await submitForm1(draft.form1Id, draft.episodeId, profile.id, studentId);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit form");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-6 w-40 rounded bg-abyssal-700" />
        <div className="h-64 rounded-lg bg-abyssal-900" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-abyssal-950 p-6 text-center gap-4">
        <CheckCircle2 className="text-lime" size={48} />
        <h1 className="font-display text-2xl text-abyssal-100">Form Submitted</h1>
        <p className="font-body text-abyssal-300 max-w-xs">
          Thank you! Your admission and assessment form has been sent to the school for review. You'll hear from us about the next step soon.
        </p>
      </div>
    );
  }

  const partAStep = phase === "a" ? PART_A_STEPS[stepIndex] : null;
  const partBDomain = phase === "b" ? FORM_B_DOMAINS[stepIndex] : null;

  return (
    <div className="min-h-screen bg-abyssal-950 p-4 space-y-6">
      <div className="flex items-center justify-between">
        {!isFirst ? (
          <button onClick={handleBack} className="text-abyssal-300" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span />
        )}
        <p className="font-ui text-xs text-abyssal-300">
          Step {overallStep + 1} of {totalSteps}
        </p>
      </div>

      <div className="h-1.5 bg-abyssal-900 rounded-full overflow-hidden">
        <div
          className="h-full bg-lime transition-all duration-300"
          style={{ width: `${((overallStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {partAStep && (
        <>
          <div>
            <h1 className="font-display text-xl text-abyssal-100">{partAStep.title}</h1>
            {partAStep.intro && <p className="font-body text-sm text-abyssal-300 mt-1">{partAStep.intro}</p>}
          </div>

          <div className="space-y-5">
            {partAStep.fields.map((field) => (
              <IntakeFieldRenderer
                key={field.key}
                field={field}
                value={formData[field.key]}
                onChange={(v) => handleFieldChange(field.key, v)}
              />
            ))}
          </div>
        </>
      )}

      {partBDomain && (
        <>
          <div>
            <h1 className="font-display text-xl text-abyssal-100">{partBDomain.title}</h1>
          </div>

          <DomainRenderer
            domain={partBDomain}
            value={partBData[partBDomain.id] ?? {}}
            onChange={(v) => handleDomainChange(partBDomain.id, v)}
          />
        </>
      )}

      {error && <p className="text-error text-sm font-ui">{error}</p>}

      {isLast ? (
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3 rounded bg-lime text-abyssal-950 font-ui font-semibold hover:bg-lime-dark active:scale-95 transition-transform transition-colors duration-150 disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Form"}
        </button>
      ) : (
        <button
          onClick={handleNext}
          disabled={saving}
          className="w-full py-3 rounded bg-lime text-abyssal-950 font-ui font-semibold hover:bg-lime-dark active:scale-95 transition-transform transition-colors duration-150 disabled:opacity-60 flex items-center justify-center gap-1"
        >
          {saving ? "Saving..." : "Next"} <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
