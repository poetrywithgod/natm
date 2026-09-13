import { PROGRESS_RANGE_OPTIONS } from "@natm/shared-types";

interface Props {
  selectedDays: number | null;
  onChange: (days: number | null) => void;
  disabled?: boolean;
}

export default function DailyLogRangeTabs({ selectedDays, onChange, disabled }: Props) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Time range">
      {PROGRESS_RANGE_OPTIONS.map((opt) => {
        const active = opt.days === selectedDays;
        return (
          <button
            key={opt.label}
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.days)}
            className={`font-ui text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors disabled:opacity-50 ${
              active ? "bg-forest-500 text-forest-950" : "bg-forest-800 text-forest-300 hover:text-forest-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
