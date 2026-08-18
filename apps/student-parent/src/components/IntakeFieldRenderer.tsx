import type { FieldConfig } from "../features/intake/types";

interface Props {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}

const inputClass =
  "w-full p-2.5 rounded bg-abyssal-700 text-abyssal-100 font-ui text-sm placeholder:text-abyssal-300/60";

export default function IntakeFieldRenderer({ field, value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="block font-ui text-sm text-abyssal-100">
        {field.label}
        {field.required && <span className="text-error ml-1">*</span>}
      </label>
      {field.helpText && <p className="font-ui text-xs text-abyssal-300">{field.helpText}</p>}

      {(field.type === "text" || field.type === "date") && (
        <input
          type={field.type}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={inputClass}
        />
      )}

      {field.type === "select" && (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === "radio" && (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 rounded-full font-ui text-xs transition-colors ${
                value === opt
                  ? "bg-lime text-abyssal-950 font-semibold"
                  : "bg-abyssal-700 text-abyssal-100 hover:bg-abyssal-500"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {field.type === "compound" && field.subFields && (
        <div className="grid sm:grid-cols-2 gap-2 bg-abyssal-900 rounded p-3">
          {field.subFields.map((sub) => (
            <input
              key={sub.key}
              type="text"
              placeholder={sub.label}
              value={((value as Record<string, string>)?.[sub.key]) ?? ""}
              onChange={(e) =>
                onChange({ ...(value as Record<string, string>), [sub.key]: e.target.value })
              }
              className={inputClass}
            />
          ))}
        </div>
      )}
    </div>
  );
}
