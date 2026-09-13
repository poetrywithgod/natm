import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

// Same idea as the staff app's CollapsibleSection, ported to Super
// Admin's Slate palette -- used to break up long single-scroll pages
// there too.
export default function CollapsibleSection({ title, subtitle, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="font-display font-bold text-slate-100">{title}</h2>
          {subtitle && <p className="font-ui text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {open ? (
          <ChevronDown size={18} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-slate-400 shrink-0" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}
