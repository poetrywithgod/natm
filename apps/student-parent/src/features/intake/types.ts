export type FieldType = "text" | "date" | "select" | "radio" | "textarea" | "compound";

export interface CompoundSubField {
  key: string;
  label: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  helpText?: string;
  options?: string[];
  subFields?: CompoundSubField[];
  required?: boolean;
}

export interface StepConfig {
  id: string;
  title: string;
  intro?: string;
  fields: FieldConfig[];
}

export const RATING_OPTIONS = ["0", "1", "2", "3", "4", "N/A"] as const;
export type RatingValue = (typeof RATING_OPTIONS)[number];

// ---- Part B domain types ----

export type DomainType = "rating" | "sensory" | "baseline" | "neurodevelopmental" | "keyvalue";

export interface RatingItem {
  id: string;
  text: string;
}

export interface SimpleItem {
  id: string;
  text: string;
}

export interface KeyValueField {
  key: string;
  label: string;
  type: "text" | "textarea" | "checklist";
  options?: string[];
}

export interface Domain {
  id: string;
  title: string;
  type: DomainType;
  intro?: string;
  items?: (RatingItem | SimpleItem)[];
  keyValueFields?: KeyValueField[];
  hasNarrative?: boolean;
}

export const IMPACT_OPTIONS = ["Positive", "None", "Variable", "Interferes", "Safety"] as const;
export const FREQUENCY_OPTIONS = ["Never", "Rare", "Sometimes", "Often", "Very often", "Unknown"] as const;

export const NARRATIVE_FIELDS: KeyValueField[] = [
  { key: "strengths", label: "Strengths / what supports success", type: "textarea" },
  { key: "priority_needs", label: "Priority support needs / barriers", type: "textarea" },
  { key: "accommodations", label: "Effective accommodations / strategies", type: "textarea" },
  { key: "baseline_evidence", label: "Baseline evidence / examples", type: "textarea" },
];
