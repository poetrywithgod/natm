import type { ReactNode } from "react";
import type { Domain, RatingItem, SimpleItem, KeyValueField } from "../features/intake/types";
import { RATING_OPTIONS, IMPACT_OPTIONS, FREQUENCY_OPTIONS, NARRATIVE_FIELDS } from "../features/intake/types";

interface Props {
  domain: Domain;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}

const inputClass =
  "w-full p-2.5 rounded bg-abyssal-700 text-abyssal-100 font-ui text-sm placeholder:text-abyssal-300/60";

function pillClass(active: boolean) {
  return `px-3 py-1.5 rounded-full font-ui text-xs transition-colors ${
    active
      ? "bg-lime text-abyssal-950 font-semibold"
      : "bg-abyssal-700 text-abyssal-100 hover:bg-abyssal-500"
  }`;
}

function itemLabel(item: RatingItem | SimpleItem) {
  return (
    <p className="font-ui text-sm text-abyssal-100">
      <span className="text-abyssal-300 mr-1.5">{item.id}</span>
      {item.text}
    </p>
  );
}

function OptionPills({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={pillClass(value === opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ItemCard({ children }: { children: ReactNode }) {
  return <div className="bg-abyssal-900 rounded-lg p-3 space-y-2.5">{children}</div>;
}

export default function DomainRenderer({ domain, value, onChange }: Props) {
  function patchItem(itemId: string, patch: Record<string, unknown>) {
    const current = (value[itemId] as Record<string, unknown>) ?? {};
    onChange({ ...value, [itemId]: { ...current, ...patch } });
  }

  function patchNarrative(key: string, val: string) {
    const current = (value.narrative as Record<string, string>) ?? {};
    onChange({ ...value, narrative: { ...current, [key]: val } });
  }

  function patchKeyValue(key: string, val: unknown) {
    onChange({ ...value, [key]: val });
  }

  function toggleChecklist(key: string, option: string) {
    const current = ((value[key] as string[]) ?? []).slice();
    const idx = current.indexOf(option);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(option);
    patchKeyValue(key, current);
  }

  return (
    <div className="space-y-4">
      {domain.intro && <p className="font-body text-xs text-abyssal-300 bg-abyssal-900 rounded-lg p-3">{domain.intro}</p>}

      {domain.type === "rating" &&
        domain.items?.map((item) => {
          const itemVal = (value[item.id] as { rating?: string; evidence?: string }) ?? {};
          return (
            <ItemCard key={item.id}>
              {itemLabel(item)}
              <OptionPills
                options={RATING_OPTIONS}
                value={itemVal.rating}
                onChange={(v) => patchItem(item.id, { rating: v })}
              />
              <textarea
                value={itemVal.evidence ?? ""}
                onChange={(e) => patchItem(item.id, { evidence: e.target.value })}
                placeholder="Evidence, context, prompt level, examples"
                rows={2}
                className={inputClass}
              />
            </ItemCard>
          );
        })}

      {domain.type === "sensory" &&
        domain.items?.map((item) => {
          const itemVal =
            (value[item.id] as { observedResponse?: string; impact?: string; whatHelps?: string }) ?? {};
          return (
            <ItemCard key={item.id}>
              {itemLabel(item)}
              <textarea
                value={itemVal.observedResponse ?? ""}
                onChange={(e) => patchItem(item.id, { observedResponse: e.target.value })}
                placeholder="Observed response / trigger"
                rows={2}
                className={inputClass}
              />
              <p className="font-ui text-xs text-abyssal-300">Impact on participation</p>
              <OptionPills
                options={IMPACT_OPTIONS}
                value={itemVal.impact}
                onChange={(v) => patchItem(item.id, { impact: v })}
              />
              <textarea
                value={itemVal.whatHelps ?? ""}
                onChange={(e) => patchItem(item.id, { whatHelps: e.target.value })}
                placeholder="What helps / preferred support"
                rows={2}
                className={inputClass}
              />
            </ItemCard>
          );
        })}

      {domain.type === "baseline" &&
        domain.items?.map((item) => {
          const itemVal =
            (value[item.id] as { baseline?: string; supportUsed?: string; evidence?: string }) ?? {};
          return (
            <ItemCard key={item.id}>
              {itemLabel(item)}
              <textarea
                value={itemVal.baseline ?? ""}
                onChange={(e) => patchItem(item.id, { baseline: e.target.value })}
                placeholder="Current baseline / observed skill"
                rows={2}
                className={inputClass}
              />
              <textarea
                value={itemVal.supportUsed ?? ""}
                onChange={(e) => patchItem(item.id, { supportUsed: e.target.value })}
                placeholder="Support used"
                rows={2}
                className={inputClass}
              />
              <textarea
                value={itemVal.evidence ?? ""}
                onChange={(e) => patchItem(item.id, { evidence: e.target.value })}
                placeholder="Evidence / sample / date"
                rows={2}
                className={inputClass}
              />
            </ItemCard>
          );
        })}

      {domain.type === "neurodevelopmental" &&
        domain.items?.map((item) => {
          const itemVal = (value[item.id] as { frequency?: string; impact?: string; context?: string }) ?? {};
          return (
            <ItemCard key={item.id}>
              {itemLabel(item)}
              <p className="font-ui text-xs text-abyssal-300">Frequency</p>
              <OptionPills
                options={FREQUENCY_OPTIONS}
                value={itemVal.frequency}
                onChange={(v) => patchItem(item.id, { frequency: v })}
              />
              <p className="font-ui text-xs text-abyssal-300">Functional impact</p>
              <OptionPills
                options={IMPACT_OPTIONS}
                value={itemVal.impact}
                onChange={(v) => patchItem(item.id, { impact: v })}
              />
              <textarea
                value={itemVal.context ?? ""}
                onChange={(e) => patchItem(item.id, { context: e.target.value })}
                placeholder="Context / evidence / what helps"
                rows={2}
                className={inputClass}
              />
            </ItemCard>
          );
        })}

      {domain.type === "keyvalue" &&
        domain.keyValueFields?.map((field: KeyValueField) => (
          <div key={field.key} className="space-y-1.5">
            <label className="block font-ui text-sm text-abyssal-100">{field.label}</label>

            {field.type === "text" && (
              <input
                type="text"
                value={(value[field.key] as string) ?? ""}
                onChange={(e) => patchKeyValue(field.key, e.target.value)}
                className={inputClass}
              />
            )}

            {field.type === "textarea" && (
              <textarea
                value={(value[field.key] as string) ?? ""}
                onChange={(e) => patchKeyValue(field.key, e.target.value)}
                rows={3}
                className={inputClass}
              />
            )}

            {field.type === "checklist" && (
              <div className="flex flex-wrap gap-1.5">
                {field.options?.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleChecklist(field.key, opt)}
                    className={pillClass(((value[field.key] as string[]) ?? []).includes(opt))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

      {domain.hasNarrative && (
        <div className="space-y-3 pt-1">
          {NARRATIVE_FIELDS.map((nf) => (
            <div key={nf.key} className="space-y-1.5">
              <label className="block font-ui text-sm text-abyssal-100">{nf.label}</label>
              <textarea
                value={((value.narrative as Record<string, string>)?.[nf.key]) ?? ""}
                onChange={(e) => patchNarrative(nf.key, e.target.value)}
                rows={2}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
