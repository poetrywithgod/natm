import type {
  SectionConfig,
  SectionValue,
  RatingTableValue,
  CheckboxListValue,
  KeyValueTableValue,
  FreeTextFieldsValue,
  LogTableValue,
  BehaviourRecordValue,
  RadioWithNoteValue,
} from "@natm/shared-types";

export interface FlatRow {
  label: string;
  value: string;
}

const EMPTY = "—";

// Mirrors SectionRenderer.tsx's read view, but produces plain label/value
// strings instead of form controls -- the shape jspdf-autotable wants for
// the raw-log appendix. One function per section type, same 7 types as
// the live form, so a new form field type only ever needs updating here
// and in SectionRenderer, never a third place.
export function flattenSection(config: SectionConfig, value: SectionValue | undefined): FlatRow[] {
  if (!value) return [{ label: config.title, value: "Not filled in" }];

  switch (config.type) {
    case "ratingTable": {
      const v = value as RatingTableValue;
      return config.rows.map((row) => {
        const rating = v.ratings?.[row.key] || EMPTY;
        const note = v.notes?.[row.key]?.trim();
        return { label: row.label, value: note ? `${rating} — ${note}` : rating };
      });
    }

    case "checkboxList": {
      const v = value as CheckboxListValue;
      return [{ label: config.title, value: v.checked?.length ? v.checked.join(", ") : EMPTY }];
    }

    case "keyValueTable": {
      const v = value as KeyValueTableValue;
      return config.rows.map((row) => {
        const cells = config.columns.map((col) => v.values?.[row.key]?.[col]?.trim() || EMPTY);
        return { label: row.label, value: cells.join(" / ") };
      });
    }

    case "freeTextFields": {
      const v = value as FreeTextFieldsValue;
      return config.fields.map((f) => ({ label: f.label, value: v.values?.[f.key]?.trim() || EMPTY }));
    }

    case "logTable": {
      const v = value as LogTableValue;
      const rows = (v.rows ?? []).filter((r) => Object.values(r).some((cell) => cell?.trim()));
      if (rows.length === 0) return [{ label: config.title, value: EMPTY }];
      return rows.map((r, i) => ({
        label: `${config.title} ${i + 1}`,
        value: config.columns.map((c) => `${c.label}: ${r[c.key]?.trim() || EMPTY}`).join("; "),
      }));
    }

    case "behaviourRecord": {
      const v = value as BehaviourRecordValue;
      const rows: FlatRow[] = [
        { label: "Antecedent (before behaviour)", value: v.antecedent?.trim() || EMPTY },
        { label: "Behaviour observed", value: v.behaviourTags?.length ? v.behaviourTags.join(", ") : EMPTY },
      ];
      if (config.interventionOptions) {
        rows.push({
          label: "Intervention provided",
          value: v.interventionTags?.length ? v.interventionTags.join(", ") : EMPTY,
        });
      }
      if (config.hasTeacherResponse) {
        rows.push({ label: "Teacher response", value: v.teacherResponse?.trim() || EMPTY });
      }
      rows.push({ label: "Outcome", value: v.outcome?.trim() || EMPTY });
      return rows;
    }

    case "radioWithNote": {
      const v = value as RadioWithNoteValue;
      const note = v.note?.trim();
      return [{ label: config.title, value: note ? `${v.selected || EMPTY} — ${note}` : v.selected || EMPTY }];
    }
  }
}

// Flattens every configured section of one day's record into a single
// list of rows, each prefixed with its section title so two sections
// that happen to share a row label (e.g. both have a "Notes" row) don't
// collide in the appendix table.
export function flattenRecord(configs: SectionConfig[], sections: Record<string, SectionValue>): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const config of configs) {
    const sectionRows = flattenSection(config, sections[config.key]);
    for (const r of sectionRows) {
      rows.push({ label: `${config.title}: ${r.label}`, value: r.value });
    }
  }
  return rows;
}
