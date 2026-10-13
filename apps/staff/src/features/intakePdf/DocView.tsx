import { useState } from "react";
import { Download, Eye, EyeOff } from "lucide-react";
import CollapsibleSection from "../../components/CollapsibleSection";
import { EMPTY, type IntakeDocument } from "./model";

interface Props {
  doc: IntakeDocument;
  heading: string;
  subtitle?: string;
  onDownload: () => void | Promise<void>;
  downloading?: boolean;
  defaultOpen?: boolean;
}

// Read-only review of a submitted form, drawn from the same IntakeDocument
// the PDF is built from. Collapsed by default so the long form doesn't push
// the approve / assign controls off the screen.
export default function DocView({ doc, heading, subtitle, onDownload, downloading, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-forest-900 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-forest-100">{heading}</p>
          {subtitle && <p className="font-ui text-xs text-forest-300 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="px-3 py-2 rounded border border-forest-700 text-forest-100 font-ui text-sm flex items-center gap-1.5"
          >
            {open ? <EyeOff size={15} /> : <Eye size={15} />}
            {open ? "Hide" : "View"}
          </button>
          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={downloading}
            className="px-3 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={15} />
            {downloading ? "Preparing..." : "Download PDF"}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 bg-forest-950 rounded-md p-3">
            {doc.meta.map((m) => (
              <div key={m.label} className="flex gap-2 font-ui text-xs">
                <dt className="text-forest-300 shrink-0">{m.label}:</dt>
                <dd className="text-forest-100 break-words">{m.value}</dd>
              </div>
            ))}
          </dl>

          {doc.sections.map((section, i) => (
            <CollapsibleSection key={section.id} title={section.title} defaultOpen={i === 0}>
              {section.intro && <p className="font-ui text-xs text-forest-300">{section.intro}</p>}
              {section.tables.map((table, ti) => (
                <div key={ti} className="overflow-x-auto rounded-md border border-forest-800">
                  <table className="w-full text-left font-ui text-sm">
                    <thead className="bg-forest-950 text-forest-300 text-xs">
                      <tr>
                        {table.head.map((h) => (
                          <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, ri) => (
                        <tr key={ri} className="border-t border-forest-800 align-top">
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className={`px-3 py-2 whitespace-pre-line break-words ${
                                cell === EMPTY
                                  ? "text-forest-300/60"
                                  : ci === 0 && table.head.length === 2
                                    ? "text-forest-100 font-semibold"
                                    : "text-forest-100"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </CollapsibleSection>
          ))}
        </div>
      )}
    </div>
  );
}
