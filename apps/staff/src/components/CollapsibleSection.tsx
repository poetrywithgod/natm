import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

// Standard collapsible card used to break up long single-scroll pages
// (Student Detail, School Profile, etc.) across the staff app. Starts
// collapsed by default so a long page reads as a list of headings first
// -- pass defaultOpen for the one or two sections that matter most on
// arrival (e.g. the first tab of a detail page).
export default function CollapsibleSection({ title, subtitle, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-forest-900 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="font-display text-lg text-forest-100">{title}</h2>
          {subtitle && <p className="font-ui text-xs text-forest-300 mt-0.5">{subtitle}</p>}
        </div>
        {open ? (
          <ChevronDown size={18} className="text-forest-300 shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-forest-300 shrink-0" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}
