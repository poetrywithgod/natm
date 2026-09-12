import { PROGRESS_RANGE_OPTIONS } from "../api";

interface Props {
  selectedDays: number | null;
  onChange: (days: number | null) => void;
  disabled?: boolean;
}

// Simple segmented control for the trailing window shown across every
// chart on the Progress page -- 1/2/3/6 months, 1 year, or the student's
// entire logged history. Deliberately a flat list rather than a dropdown:
// there are only six options and this is the single most important
// control on the page (it decides what "journey" means for everything
// below it).
export default function ProgressRangeTabs({ selectedDays, onChange, disabled }: Props) {
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
              active ? "bg-lime text-abyssal-950" : "bg-abyssal-900 text-abyssal-300 hover:text-abyssal-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
