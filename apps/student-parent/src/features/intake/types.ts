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

// Part B domain rating item (GM01, FM01, etc.)
export interface RatingItem {
  id: string;
  text: string;
}

export interface DomainConfig {
  id: string;
  title: string;
  items: RatingItem[];
}

export const RATING_OPTIONS = ["0", "1", "2", "3", "4", "N/A"] as const;
export type RatingValue = (typeof RATING_OPTIONS)[number];
