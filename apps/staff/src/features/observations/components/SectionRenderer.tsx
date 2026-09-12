import { Plus, Trash2 } from "lucide-react";
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
} from "../sectionTypes";

const inputCls =
  "w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm placeholder:text-forest-300/60 border border-transparent focus:border-forest-400 focus:outline-none";
const cardCls = "bg-forest-900 rounded-lg p-4 space-y-3";
const legendCls = "font-ui text-sm font-semibold text-forest-100";
const rowLegendCls = "font-ui text-xs font-medium text-forest-200";
const checkboxRowCls = "flex items-center gap-2";

interface Props {
  config: SectionConfig;
  value: SectionValue;
  onChange: (next: SectionValue) => void;
  disabled?: boolean;
}

export default function SectionRenderer({ config, value, onChange, disabled }: Props) {
  return (
    <section className={cardCls} aria-labelledby={`section-${config.key}-title`}>
      <div>
        <h3 id={`section-${config.key}-title`} className={legendCls}>
          {config.title}
        </h3>
        {"timeLabel" in config && config.timeLabel && (
          <p className="font-ui text-xs text-forest-300">{config.timeLabel}</p>
        )}
      </div>
      {renderBody(config, value, onChange, disabled)}
    </section>
  );
}

function renderBody(
  config: SectionConfig,
  value: SectionValue,
  onChange: (next: SectionValue) => void,
  disabled?: boolean
) {
  switch (config.type) {
    case "ratingTable": {
      const v = value as RatingTableValue;
      return (
        <div className="space-y-3">
          {config.rows.map((row) => (
            <fieldset key={row.key} className="space-y-1.5" disabled={disabled}>
              <legend className={rowLegendCls}>{row.label}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {config.options.map((opt) => {
                  const id = `${config.key}-${row.key}-${opt}`;
                  return (
                    <label key={opt} htmlFor={id} className={checkboxRowCls}>
                      <input
                        id={id}
                        type="radio"
                        name={`${config.key}-${row.key}`}
                        checked={v.ratings[row.key] === opt}
                        onChange={() =>
                          onChange({ ...v, ratings: { ...v.ratings, [row.key]: opt } })
                        }
                        className="accent-forest-400"
                      />
                      <span className="font-ui text-xs text-forest-100">{opt}</span>
                    </label>
                  );
                })}
              </div>
              <input
                type="text"
                aria-label={`Notes for ${row.label}`}
                placeholder="Notes (optional)"
                value={v.notes[row.key] ?? ""}
                onChange={(e) => onChange({ ...v, notes: { ...v.notes, [row.key]: e.target.value } })}
                className={inputCls}
              />
            </fieldset>
          ))}
        </div>
      );
    }

    case "checkboxList": {
      const v = value as CheckboxListValue;
      const otherValue = v.checked.find((c) => c.startsWith("Other:"))?.slice(6).trim() ?? "";
      const isOtherChecked = v.checked.some((c) => c === "Other" || c.startsWith("Other:"));
      return (
        <fieldset className="space-y-1.5" disabled={disabled}>
          <legend className="sr-only">{config.title}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {config.options.map((opt) => {
              const id = `${config.key}-${opt}`;
              const checked = v.checked.includes(opt);
              return (
                <label key={opt} htmlFor={id} className={checkboxRowCls}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange({
                        checked: checked ? v.checked.filter((c) => c !== opt) : [...v.checked, opt],
                      })
                    }
                    className="accent-forest-400"
                  />
                  <span className="font-ui text-xs text-forest-100">{opt}</span>
                </label>
              );
            })}
            {config.otherOption && (
              <label htmlFor={`${config.key}-other`} className={checkboxRowCls}>
                <input
                  id={`${config.key}-other`}
                  type="checkbox"
                  checked={isOtherChecked}
                  onChange={() =>
                    onChange({
                      checked: isOtherChecked
                        ? v.checked.filter((c) => c !== "Other" && !c.startsWith("Other:"))
                        : [...v.checked, "Other"],
                    })
                  }
                  className="accent-forest-400"
                />
                <span className="font-ui text-xs text-forest-100">Other</span>
              </label>
            )}
          </div>
          {config.otherOption && isOtherChecked && (
            <input
              type="text"
              aria-label="Specify other"
              placeholder="Specify..."
              value={otherValue}
              onChange={(e) =>
                onChange({
                  checked: [
                    ...v.checked.filter((c) => c !== "Other" && !c.startsWith("Other:")),
                    `Other: ${e.target.value}`,
                  ],
                })
              }
              className={inputCls}
            />
          )}
        </fieldset>
      );
    }

    case "keyValueTable": {
      const v = value as KeyValueTableValue;
      return (
        <div className="space-y-3">
          {config.rows.map((row) => (
            <fieldset key={row.key} className="space-y-1.5" disabled={disabled}>
              <legend className={rowLegendCls}>{row.label}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.columns.map((col) => (
                  <div key={col}>
                    <label
                      htmlFor={`${config.key}-${row.key}-${col}`}
                      className="font-ui text-[11px] text-forest-300"
                    >
                      {col}
                    </label>
                    <input
                      id={`${config.key}-${row.key}-${col}`}
                      type="text"
                      value={v.values[row.key]?.[col] ?? ""}
                      onChange={(e) =>
                        onChange({
                          values: {
                            ...v.values,
                            [row.key]: { ...v.values[row.key], [col]: e.target.value },
                          },
                        })
                      }
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      );
    }

    case "freeTextFields": {
      const v = value as FreeTextFieldsValue;
      return (
        <div className="space-y-3">
          {config.fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`${config.key}-${f.key}`} className={rowLegendCls}>
                {f.label}
              </label>
              <textarea
                id={`${config.key}-${f.key}`}
                rows={2}
                value={v.values[f.key] ?? ""}
                onChange={(e) => onChange({ values: { ...v.values, [f.key]: e.target.value } })}
                className={`${inputCls} mt-1`}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      );
    }

    case "logTable": {
      const v = value as LogTableValue;
      const rows = v.rows.length > 0 ? v.rows : [{}];
      return (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              {config.columns.map((col) => (
                <div key={col.key}>
                  <label
                    htmlFor={`${config.key}-${i}-${col.key}`}
                    className="font-ui text-[11px] text-forest-300"
                  >
                    {col.label}
                  </label>
                  <input
                    id={`${config.key}-${i}-${col.key}`}
                    type="text"
                    value={r[col.key] ?? ""}
                    onChange={(e) => {
                      const nextRows = rows.map((rr, ri) =>
                        ri === i ? { ...rr, [col.key]: e.target.value } : rr
                      );
                      onChange({ rows: nextRows });
                    }}
                    className={inputCls}
                    disabled={disabled}
                  />
                </div>
              ))}
              {!disabled && rows.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove row ${i + 1}`}
                  onClick={() => onChange({ rows: rows.filter((_, ri) => ri !== i) })}
                  className="justify-self-start text-forest-300 hover:text-error p-1.5"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange({ rows: [...rows, {}] })}
              className="flex items-center gap-1 font-ui text-xs text-forest-300 hover:text-forest-100"
            >
              <Plus size={14} /> Add row
            </button>
          )}
        </div>
      );
    }

    case "behaviourRecord": {
      const v = value as BehaviourRecordValue;
      return (
        <div className="space-y-3">
          <div>
            <label htmlFor={`${config.key}-antecedent`} className={rowLegendCls}>
              Antecedent (Before behaviour)
            </label>
            <textarea
              id={`${config.key}-antecedent`}
              rows={2}
              value={v.antecedent}
              onChange={(e) => onChange({ ...v, antecedent: e.target.value })}
              className={`${inputCls} mt-1`}
              disabled={disabled}
            />
          </div>
          <fieldset className="space-y-1.5" disabled={disabled}>
            <legend className={rowLegendCls}>Behaviour observed</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {config.behaviourOptions.map((opt) => {
                const id = `${config.key}-behaviour-${opt}`;
                const checked = v.behaviourTags.includes(opt);
                return (
                  <label key={opt} htmlFor={id} className={checkboxRowCls}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange({
                          ...v,
                          behaviourTags: checked
                            ? v.behaviourTags.filter((t) => t !== opt)
                            : [...v.behaviourTags, opt],
                        })
                      }
                      className="accent-forest-400"
                    />
                    <span className="font-ui text-xs text-forest-100">{opt}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {config.interventionOptions && (
            <fieldset className="space-y-1.5" disabled={disabled}>
              <legend className={rowLegendCls}>Intervention Provided</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {config.interventionOptions.map((opt) => {
                  const id = `${config.key}-intervention-${opt}`;
                  const checked = (v.interventionTags ?? []).includes(opt);
                  return (
                    <label key={opt} htmlFor={id} className={checkboxRowCls}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onChange({
                            ...v,
                            interventionTags: checked
                              ? (v.interventionTags ?? []).filter((t) => t !== opt)
                              : [...(v.interventionTags ?? []), opt],
                          })
                        }
                        className="accent-forest-400"
                      />
                      <span className="font-ui text-xs text-forest-100">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {config.hasTeacherResponse && (
            <div>
              <label htmlFor={`${config.key}-response`} className={rowLegendCls}>
                Teacher response
              </label>
              <textarea
                id={`${config.key}-response`}
                rows={2}
                value={v.teacherResponse ?? ""}
                onChange={(e) => onChange({ ...v, teacherResponse: e.target.value })}
                className={`${inputCls} mt-1`}
                disabled={disabled}
              />
            </div>
          )}
          <div>
            <label htmlFor={`${config.key}-outcome`} className={rowLegendCls}>
              Outcome
            </label>
            <textarea
              id={`${config.key}-outcome`}
              rows={2}
              value={v.outcome}
              onChange={(e) => onChange({ ...v, outcome: e.target.value })}
              className={`${inputCls} mt-1`}
              disabled={disabled}
            />
          </div>
        </div>
      );
    }

    case "radioWithNote": {
      const v = value as RadioWithNoteValue;
      return (
        <div className="space-y-3">
          <fieldset className="space-y-1.5" disabled={disabled}>
            <legend className="sr-only">{config.title}</legend>
            <div className="flex flex-col gap-1.5">
              {config.options.map((opt) => {
                const id = `${config.key}-${opt}`;
                return (
                  <label key={opt} htmlFor={id} className={checkboxRowCls}>
                    <input
                      id={id}
                      type="radio"
                      name={config.key}
                      checked={v.selected === opt}
                      onChange={() => onChange({ ...v, selected: opt })}
                      className="accent-forest-400"
                    />
                    <span className="font-ui text-xs text-forest-100">{opt}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`${config.key}-note`} className={rowLegendCls}>
              {config.noteLabel}
            </label>
            <textarea
              id={`${config.key}-note`}
              rows={2}
              value={v.note}
              onChange={(e) => onChange({ ...v, note: e.target.value })}
              className={`${inputCls} mt-1`}
              disabled={disabled}
            />
          </div>
        </div>
      );
    }
  }
}
