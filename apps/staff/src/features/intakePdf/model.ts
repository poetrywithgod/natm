import {
  PART_A_STEPS,
  FORM_B_DOMAINS,
  NARRATIVE_FIELDS,
  RATING_OPTIONS,
  IMPACT_OPTIONS,
  FREQUENCY_OPTIONS,
  CLASS_LEVEL_LABELS,
  type ClassLevel,
  type Domain,
  type FieldConfig,
} from "@natm/shared-types";
import type { EpisodeDetail } from "../assessments/api";
import { FORM_TWO_DOMAINS } from "../observation/form2Config";
import {
  CONFIDENCE_OPTIONS,
  FC_OPTIONS,
  OBSERVATION_INFO_FIELDS,
  OBSERVATION_SEGMENTS,
  SNAPSHOT_FIELDS,
} from "../observation/observationTypes";

// A plain, renderer-agnostic description of a submitted form. The on-screen
// review (DocView) and the downloadable PDF (renderPdf) both draw from this
// one structure, so what the admin reviews is exactly what they download.

export interface DocTable {
  head: string[];
  rows: string[][];
  // Relative column widths (any positive numbers); omitted = equal.
  widths?: number[];
}

export interface DocSection {
  id: string;
  title: string;
  intro?: string;
  tables: DocTable[];
}

export interface IntakeDocument {
  kind: "form1" | "form2";
  title: string;
  fileStem: string; // used for the download filename
  meta: { label: string; value: string }[];
  sections: DocSection[];
}

export const EMPTY = "—"; // em dash

export function prettyLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${formatDate(iso)}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Any stored value -> display string. Never throws; unknown shapes are
// flattened rather than hidden so no recorded data silently disappears.
export function fmt(value: unknown): string {
  if (value === null || value === undefined) return EMPTY;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return EMPTY;
    return ISO_DATE.test(t) ? formatDate(t + "T00:00:00") : t;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => fmt(v)).filter((v) => v !== EMPTY);
    return parts.length ? parts.join(", ") : EMPTY;
  }
  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, fmt(v)] as const)
      .filter(([, v]) => v !== EMPTY)
      .map(([k, v]) => `${prettyLabel(k)}: ${v}`);
    return parts.length ? parts.join("\n") : EMPTY;
  }
  return String(value);
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function levelLabel(level: string | null): string {
  if (!level) return EMPTY;
  return CLASS_LEVEL_LABELS[level as ClassLevel] ?? prettyLabel(level);
}

function statusLabel(status: string): string {
  switch (status) {
    case "form1_draft":
      return "Form 1 in progress";
    case "form1_submitted":
      return "Form 1 submitted, awaiting review";
    case "form1_approved":
      return "Form 1 approved";
    case "form2_draft":
      return "Form 2 in progress";
    case "form2_submitted":
      return "Form 2 submitted";
    case "ai_suggested":
      return "Recommendation ready for approval";
    case "completed":
      return "Processed, subjects approved";
    default:
      return prettyLabel(status);
  }
}

function fieldRow(field: FieldConfig, data: Record<string, unknown>): string[] {
  const raw = data[field.key];
  if (field.type === "compound") {
    const obj = asRecord(raw);
    const lines = (field.subFields ?? [])
      .map((sf) => [sf.label, fmt(obj[sf.key])] as const)
      .filter(([, v]) => v !== EMPTY)
      .map(([l, v]) => `${l}: ${v}`);
    return [field.label, lines.length ? lines.join("\n") : EMPTY];
  }
  return [field.label, fmt(raw)];
}

function domainTables(domain: Domain, value: Record<string, unknown>): DocTable[] {
  const items = domain.items ?? [];
  const tables: DocTable[] = [];

  if (domain.type === "rating") {
    tables.push({
      head: ["Item", "Rating", "Evidence / context"],
      widths: [5, 1.1, 4],
      rows: items.map((it) => {
        const v = asRecord(value[it.id]);
        return [`${it.id}  ${it.text}`, fmt(v.rating), fmt(v.evidence)];
      }),
    });
  } else if (domain.type === "sensory") {
    tables.push({
      head: ["Item", "Observed response / trigger", "Impact", "What helps"],
      widths: [4, 3, 1.4, 3],
      rows: items.map((it) => {
        const v = asRecord(value[it.id]);
        return [`${it.id}  ${it.text}`, fmt(v.observedResponse), fmt(v.impact), fmt(v.whatHelps)];
      }),
    });
  } else if (domain.type === "baseline") {
    tables.push({
      head: ["Item", "Current baseline", "Support used", "Evidence / date"],
      widths: [4, 3, 2.5, 2.5],
      rows: items.map((it) => {
        const v = asRecord(value[it.id]);
        return [`${it.id}  ${it.text}`, fmt(v.baseline), fmt(v.supportUsed), fmt(v.evidence)];
      }),
    });
  } else if (domain.type === "neurodevelopmental") {
    tables.push({
      head: ["Item", "Frequency", "Functional impact", "Context / what helps"],
      widths: [4, 1.5, 1.6, 4],
      rows: items.map((it) => {
        const v = asRecord(value[it.id]);
        return [`${it.id}  ${it.text}`, fmt(v.frequency), fmt(v.impact), fmt(v.context)];
      }),
    });
  } else if (domain.type === "keyvalue") {
    tables.push({
      head: ["Question", "Response"],
      widths: [4, 6],
      rows: (domain.keyValueFields ?? []).map((f) => [f.label, fmt(value[f.key])]),
    });
  }

  if (domain.hasNarrative) {
    const narrative = asRecord(value.narrative);
    tables.push({
      head: ["Summary", "Response"],
      widths: [4, 6],
      rows: NARRATIVE_FIELDS.map((nf) => [nf.label, fmt(narrative[nf.key])]),
    });
  }
  return tables;
}

function domainIntro(domain: Domain): string | undefined {
  const parts: string[] = [];
  if (domain.intro) parts.push(domain.intro);
  if (domain.type === "rating") parts.push(`Rating scale: ${RATING_OPTIONS.join(", ")}.`);
  if (domain.type === "sensory") parts.push(`Impact options: ${IMPACT_OPTIONS.join(", ")}.`);
  if (domain.type === "neurodevelopmental")
    parts.push(`Frequency: ${FREQUENCY_OPTIONS.join(", ")}. Impact: ${IMPACT_OPTIONS.join(", ")}.`);
  return parts.length ? parts.join(" ") : undefined;
}

export interface Form1BuildInput {
  detail: EpisodeDetail;
  schoolName: string;
}

export function buildForm1Document({ detail, schoolName }: Form1BuildInput): IntakeDocument {
  const partA = asRecord(detail.partA);
  const partB = asRecord(detail.partB);

  const sections: DocSection[] = [];
  const knownKeys = new Set<string>();

  for (const step of PART_A_STEPS) {
    for (const f of step.fields) knownKeys.add(f.key);
    sections.push({
      id: step.id,
      title: `${step.id}. ${step.title}`,
      intro: step.intro,
      tables: [{ head: ["Field", "Response"], widths: [4, 6], rows: step.fields.map((f) => fieldRow(f, partA)) }],
    });
  }

  // Anything stored under a key the current form config doesn't know about
  // (e.g. a field renamed or removed since the family filled it in) still
  // appears, so a review/PDF can never silently drop recorded data.
  const extraKeys = Object.keys(partA).filter((k) => !knownKeys.has(k) && fmt(partA[k]) !== EMPTY);
  if (extraKeys.length > 0) {
    sections.push({
      id: "A-other",
      title: "Other recorded information",
      tables: [
        { head: ["Field", "Response"], widths: [4, 6], rows: extraKeys.map((k) => [prettyLabel(k), fmt(partA[k])]) },
      ],
    });
  }

  for (const domain of FORM_B_DOMAINS) {
    sections.push({
      id: domain.id,
      title: domain.title,
      intro: domainIntro(domain),
      tables: domainTables(domain, asRecord(partB[domain.id])),
    });
  }

  const consents = asRecord(detail.consents);
  const consentRows = Object.entries(consents)
    .map(([k, v]) => [prettyLabel(k), fmt(v)])
    .filter(([, v]) => v !== EMPTY);
  if (consentRows.length > 0) {
    sections.push({
      id: "consents",
      title: "Consents recorded separately",
      tables: [{ head: ["Consent", "Response"], widths: [4, 6], rows: consentRows }],
    });
  }

  return {
    kind: "form1",
    title: "Form 1 — Admission, Family Intake & Consent",
    fileStem: `${detail.studentName.replace(/\s+/g, "_")}_Form1_episode${detail.episodeNumber}`,
    meta: [
      { label: "School", value: schoolName },
      { label: "Learner", value: detail.studentName },
      { label: "Learner ID", value: detail.uniqueStudentId },
      { label: "Assessment episode", value: String(detail.episodeNumber) },
      { label: "Submitted", value: formatDateTime(detail.form1SubmittedAt) },
      { label: "Approved by school", value: formatDateTime(detail.form1ApprovedAt) },
      { label: "Current status", value: statusLabel(detail.status) },
    ],
    sections,
  };
}

// Mirror of the stored form2_submissions row, as the staff review needs it.
export interface Form2Record {
  id: string;
  observationInfo: Record<string, unknown>;
  protocolNotes: Record<string, unknown>;
  domains: Record<string, unknown>; // { domains: {paramId: {...}}, snapshot: {...} }
  submittedAt: string | null;
  submittedByName: string | null;
}

export interface Form2BuildInput {
  detail: EpisodeDetail;
  form2: Form2Record;
  schoolName: string;
}

export function buildForm2Document({ detail, form2, schoolName }: Form2BuildInput): IntakeDocument {
  const info = asRecord(form2.observationInfo);
  const notes = asRecord(form2.protocolNotes);
  const noteSegments = asRecord(notes.segments);
  const domainValues = asRecord(asRecord(form2.domains).domains);
  const snapshot = asRecord(asRecord(form2.domains).snapshot);

  const sections: DocSection[] = [];

  sections.push({
    id: "info",
    title: "Observation information",
    tables: [
      {
        head: ["Field", "Response"],
        widths: [4, 6],
        rows: OBSERVATION_INFO_FIELDS.map((f) => [f.label, fmt(info[f.key])]),
      },
    ],
  });

  sections.push({
    id: "protocol",
    title: "Observation protocol notes",
    tables: [
      {
        head: ["Segment", "Observations"],
        widths: [3, 7],
        rows: OBSERVATION_SEGMENTS.map((s) => [s.label, fmt(notes[s.key] ?? noteSegments[s.key])]),
      },
    ],
  });

  for (const domain of FORM_TWO_DOMAINS) {
    sections.push({
      id: domain.id,
      title: domain.title,
      intro: `Functional capacity (FC) and support intensity (SI): ${FC_OPTIONS.join(", ")} (N/O = not observed). Confidence: ${CONFIDENCE_OPTIONS.join(" / ")}.`,
      tables: [
        {
          head: ["Parameter", "FC", "SI", "Conf.", "Evidence observed", "Immediate support"],
          widths: [4, 0.8, 0.8, 0.9, 3.5, 3],
          rows: domain.parameters.map((p) => {
            const v = asRecord(domainValues[p.id]);
            return [
              `${p.id}  ${p.text}`,
              fmt(v.functionalCapacity),
              fmt(v.supportIntensity),
              fmt(v.confidence),
              fmt(v.evidence),
              fmt(v.immediateSupport),
            ];
          }),
        },
      ],
    });
  }

  sections.push({
    id: "snapshot",
    title: "Observation snapshot",
    tables: [
      { head: ["Item", "Response"], widths: [4, 6], rows: SNAPSHOT_FIELDS.map((f) => [f.label, fmt(snapshot[f.key])]) },
    ],
  });

  // Once the admin has generated / approved the recommendation, include the
  // outcome so the PDF is a complete record of the processed assessment.
  if (detail.status === "ai_suggested" || detail.status === "completed") {
    const approved = detail.approvedSubjects;
    const subjects = approved ?? detail.suggestedSubjects;
    const tables: DocTable[] = [
      {
        head: ["Item", "Outcome"],
        widths: [4, 6],
        rows: [
          ["Recommendation summary", fmt(detail.suggestedSummary)],
          ["Suggested class level", levelLabel(detail.suggestedLevel)],
          ["Approved class level", levelLabel(detail.approvedLevel)],
          ["Class assigned", fmt(detail.classAssignedAt ? detail.currentClassName : null)],
          ["Shadow teacher assigned", fmt(detail.shadowTeacherAssignedAt ? detail.currentShadowTeacherName : null)],
        ],
      },
    ];
    if (subjects.length > 0) {
      tables.push({
        head: [approved ? "Approved subject" : "Suggested subject", "Rationale"],
        widths: [3, 7],
        rows: subjects.map((s) => [s.subject_name, fmt(s.rationale)]),
      });
    }
    sections.push({
      id: "outcome",
      title: "Processing outcome",
      intro: approved
        ? "Reviewed and approved by the school."
        : "AI-generated suggestion awaiting school approval. Not a diagnosis.",
      tables,
    });
  }

  return {
    kind: "form2",
    title: "Form 2 — Observation & Functional Assessment",
    fileStem: `${detail.studentName.replace(/\s+/g, "_")}_Form2_episode${detail.episodeNumber}`,
    meta: [
      { label: "School", value: schoolName },
      { label: "Learner", value: detail.studentName },
      { label: "Learner ID", value: detail.uniqueStudentId },
      { label: "Assessment episode", value: String(detail.episodeNumber) },
      { label: "Submitted", value: formatDateTime(form2.submittedAt) },
      { label: "Submitted by", value: fmt(form2.submittedByName) },
      { label: "Current status", value: statusLabel(detail.status) },
    ],
    sections,
  };
}
