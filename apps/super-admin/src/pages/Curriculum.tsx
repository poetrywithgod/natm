import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, ExternalLink, Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  fetchSubjects,
  createSubject,
  fetchAllCurriculumDocs,
  uploadCurriculumPdf,
  deleteCurriculumPdf,
  CLASS_LEVELS,
  type Subject,
  type CurriculumDoc,
  type ClassLevel,
} from "../features/curriculum/api";

const TERMS = [1, 2, 3];

export default function Curriculum() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [docs, setDocs] = useState<CurriculumDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLevel, setExpandedLevel] = useState<ClassLevel | null>(null);

  const [newSubject, setNewSubject] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([fetchSubjects(), fetchAllCurriculumDocs()]);
      setSubjects(s);
      setDocs(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load curriculum");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddSubject() {
    if (!newSubject.trim()) return;
    setAddingSubject(true);
    setError(null);
    try {
      await createSubject(newSubject.trim());
      setNewSubject("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add subject");
    } finally {
      setAddingSubject(false);
    }
  }

  function docFor(subjectId: string, level: ClassLevel, term: number) {
    return docs.find((d) => d.subject_id === subjectId && d.level === level && d.term_number === term);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-100">Curriculum</h1>
        <p className="font-body text-sm text-slate-400 mt-1">
          Upload once here -- automatically available to every school for the matching class level.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-display font-bold text-slate-100 text-sm">Subjects</h2>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <span key={s.id} className="font-ui text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">
              {s.name}
            </span>
          ))}
        </div>
        <div className="flex gap-2 max-w-sm">
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="New subject name"
            className="flex-1 p-2 rounded bg-slate-800 border border-slate-700 text-slate-100 font-body text-sm placeholder:text-slate-500"
          />
          <button
            onClick={handleAddSubject}
            disabled={addingSubject}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-ui text-xs font-semibold disabled:opacity-60"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      {loading ? (
        <p className="font-ui text-sm text-slate-400">Loading...</p>
      ) : (
        <div className="space-y-3">
          {CLASS_LEVELS.map((level) => (
            <div key={level.value} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedLevel(expandedLevel === level.value ? null : level.value)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-2">
                  {expandedLevel === level.value ? (
                    <ChevronDown size={16} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                  )}
                  <span className="font-display font-bold text-slate-100">{level.label}</span>
                </div>
                <span className="font-ui text-xs text-slate-500">
                  {docs.filter((d) => d.level === level.value && d.pdf_url).length} document
                  {docs.filter((d) => d.level === level.value && d.pdf_url).length === 1 ? "" : "s"}
                </span>
              </button>

              {expandedLevel === level.value && (
                <div className="border-t border-slate-800 divide-y divide-slate-800">
                  {subjects.length === 0 ? (
                    <p className="p-4 font-ui text-xs text-slate-500">Add a subject above first.</p>
                  ) : (
                    subjects.map((subject) => (
                      <div key={subject.id} className="p-4">
                        <p className="font-body text-sm text-slate-100 mb-2">{subject.name}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {TERMS.map((term) => (
                            <TermSlot
                              key={term}
                              term={term}
                              doc={docFor(subject.id, level.value, term)}
                              onUpload={async (file) => {
                                await uploadCurriculumPdf(subject.id, level.value, term, file);
                                await load();
                              }}
                              onDelete={async (docId) => {
                                await deleteCurriculumPdf(docId);
                                await load();
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TermSlot({
  term,
  doc,
  onUpload,
  onDelete,
}: {
  term: number;
  doc: CurriculumDoc | undefined;
  onUpload: (file: File) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPdf = !!doc?.pdf_url;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("PDF files only.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!doc || !window.confirm(`Remove the Term ${term} PDF?`)) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(doc.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <p className="font-ui text-xs text-slate-400">Term {term}</p>
      {hasPdf ? (
        <div className="space-y-2">
          <p className="font-body text-xs text-slate-100 truncate" title={doc?.pdf_filename ?? ""}>
            {doc?.pdf_filename}
          </p>
          <div className="flex gap-2">
            <a
              href={doc?.pdf_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-ui text-xs text-amber-400 hover:underline"
            >
              <ExternalLink size={12} /> View
            </a>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="flex items-center gap-1 font-ui text-xs text-error hover:underline disabled:opacity-50"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-1 py-2 rounded border border-dashed border-slate-600 text-slate-400 font-ui text-xs hover:border-amber-500/50 hover:text-amber-400 disabled:opacity-50"
        >
          <Upload size={12} /> {busy ? "Uploading..." : "Upload PDF"}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
      {error && <p className="font-ui text-xs text-error">{error}</p>}
    </div>
  );
}
