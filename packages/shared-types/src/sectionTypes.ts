// Shared section config types used to render both the Class Teacher's
// Daily Teacher Observation Form and the Shadow Teacher's Daily Support
// & Intervention Record from a single generic renderer. Every section
// config carries a `key` that indexes into the record's `sections`
// jsonb column, so the DB schema never has to change when a paper
// form's wording changes -- only these configs do.

export interface RatingRow {
  key: string;
  label: string;
}

export interface RatingTableValue {
  ratings: Record<string, string>; // rowKey -> selected option
  notes: Record<string, string>; // rowKey -> free-text note
}

export interface RatingTableSection {
  type: "ratingTable";
  key: string;
  title: string;
  timeLabel?: string;
  options: string[];
  rows: RatingRow[];
}

export interface CheckboxListValue {
  checked: string[];
}

export interface CheckboxListSection {
  type: "checkboxList";
  key: string;
  title: string;
  timeLabel?: string;
  options: string[];
  otherOption?: boolean; // renders a free-text "Other" field, stored under checked as `Other: ...`
}

export interface KeyValueTableValue {
  values: Record<string, Record<string, string>>; // rowKey -> columnLabel -> text
}

export interface KeyValueTableSection {
  type: "keyValueTable";
  key: string;
  title: string;
  columns: string[];
  rows: RatingRow[];
}

export interface FreeTextFieldsValue {
  values: Record<string, string>;
}

export interface FreeTextFieldsSection {
  type: "freeTextFields";
  key: string;
  title: string;
  fields: { key: string; label: string }[];
}

export interface LogTableValue {
  rows: Record<string, string>[];
}

export interface LogTableSection {
  type: "logTable";
  key: string;
  title: string;
  columns: { key: string; label: string }[];
  minRows?: number;
}

export interface BehaviourRecordValue {
  antecedent: string;
  behaviourTags: string[];
  interventionTags?: string[];
  teacherResponse?: string;
  outcome: string;
}

export interface BehaviourRecordSection {
  type: "behaviourRecord";
  key: string;
  title: string;
  behaviourOptions: string[];
  interventionOptions?: string[];
  hasTeacherResponse?: boolean;
}

export interface RadioWithNoteValue {
  selected: string;
  note: string;
}

export interface RadioWithNoteSection {
  type: "radioWithNote";
  key: string;
  title: string;
  options: string[];
  noteLabel: string;
}

export type SectionConfig =
  | RatingTableSection
  | CheckboxListSection
  | KeyValueTableSection
  | FreeTextFieldsSection
  | LogTableSection
  | BehaviourRecordSection
  | RadioWithNoteSection;

export type SectionValue =
  | RatingTableValue
  | CheckboxListValue
  | KeyValueTableValue
  | FreeTextFieldsValue
  | LogTableValue
  | BehaviourRecordValue
  | RadioWithNoteValue;

export type SectionsData = Record<string, SectionValue>;

export function emptyValueFor(config: SectionConfig): SectionValue {
  switch (config.type) {
    case "ratingTable":
      return { ratings: {}, notes: {} };
    case "checkboxList":
      return { checked: [] };
    case "keyValueTable":
      return { values: {} };
    case "freeTextFields":
      return { values: {} };
    case "logTable":
      return { rows: Array.from({ length: config.minRows ?? 1 }, () => ({})) };
    case "behaviourRecord":
      return { antecedent: "", behaviourTags: [], interventionTags: [], teacherResponse: "", outcome: "" };
    case "radioWithNote":
      return { selected: "", note: "" };
  }
}

export function initSections(configs: SectionConfig[], existing?: SectionsData): SectionsData {
  const result: SectionsData = {};
  for (const c of configs) {
    result[c.key] = (existing?.[c.key] as SectionValue) ?? emptyValueFor(c);
  }
  return result;
}
