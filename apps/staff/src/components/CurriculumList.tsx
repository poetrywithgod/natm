import { FileText, ExternalLink, Download } from "lucide-react";
import { CLASS_LEVEL_LABELS, type CurriculumDocView } from "../features/curriculum/api";

// Two display modes: "all-terms" groups Level -> Subject -> each term as
// a row (used by School Admin, who sees every term at once). "current-
// term" is a flat Subject list since every doc is already the same term
// (used by Class/Shadow Teacher and Student, who only ever see the
// current term's material).
export default function CurriculumList({
  docs,
  mode,
}: {
  docs: CurriculumDocView[];
  mode: "all-terms" | "current-term";
}) {
  if (docs.length === 0) {
    return (
      <div className="bg-forest-900 rounded-lg p-8 text-center">
        <FileText className="mx-auto text-forest-600 mb-2" size={28} />
        <p className="font-ui text-sm text-forest-300">No curriculum documents available yet.</p>
      </div>
    );
  }

  if (mode === "current-term") {
    return (
      <div className="space-y-2">
        {docs.map((d) => (
          <DocRow key={d.id} doc={d} showLevel />
        ))}
      </div>
    );
  }

  const levels = [...new Set(docs.map((d) => d.level))];
  return (
    <div className="space-y-4">
      {levels.map((level) => {
        const levelDocs = docs.filter((d) => d.level === level);
        const subjects = [...new Set(levelDocs.map((d) => d.subject_name))];
        return (
          <div key={level} className="bg-forest-900 rounded-lg p-4 space-y-3">
            <h3 className="font-display text-forest-100">{CLASS_LEVEL_LABELS[level] ?? level}</h3>
            {subjects.map((subject) => (
              <div key={subject} className="pl-2 border-l-2 border-forest-700 space-y-1">
                <p className="font-ui text-xs text-forest-300">{subject}</p>
                {levelDocs
                  .filter((d) => d.subject_name === subject)
                  .sort((a, b) => a.term_number - b.term_number)
                  .map((d) => (
                    <DocRow key={d.id} doc={d} />
                  ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DocRow({ doc, showLevel }: { doc: CurriculumDocView; showLevel?: boolean }) {
  return (
    <div className="flex items-center justify-between bg-forest-800 rounded p-2.5">
      <div className="min-w-0">
        <p className="font-body text-sm text-forest-100 truncate">
          {showLevel ? `${doc.subject_name} · ${CLASS_LEVEL_LABELS[doc.level] ?? doc.level}` : `Term ${doc.term_number}`}
        </p>
        {doc.pdf_filename && <p className="font-ui text-xs text-forest-400 truncate">{doc.pdf_filename}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <a
          href={doc.pdf_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-ui text-xs text-forest-300 hover:text-forest-100"
          aria-label="View PDF"
        >
          <ExternalLink size={14} />
        </a>
        <a
          href={doc.pdf_url ?? "#"}
          download={doc.pdf_filename ?? undefined}
          className="flex items-center gap-1 font-ui text-xs text-forest-300 hover:text-forest-100"
          aria-label="Download PDF"
        >
          <Download size={14} />
        </a>
      </div>
    </div>
  );
}
