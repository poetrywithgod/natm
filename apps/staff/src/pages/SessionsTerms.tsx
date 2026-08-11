import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchSessions,
  fetchTerms,
  createSession,
  createTerm,
  updateTermDates,
  setCurrentSession,
  setCurrentTerm,
  type AcademicSession,
  type Term,
} from "../features/sessions-terms/api";

export default function SessionsTerms() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [termsBySession, setTermsBySession] = useState<Record<string, Term[]>>({});
  const [newSessionName, setNewSessionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keyed by `${sessionId}:${termNumber}` — dates picked before a new term is created.
  const [pendingDates, setPendingDates] = useState<Record<string, { start: string; end: string }>>({});
  // Which existing term's date fields are currently open for editing.
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editDates, setEditDates] = useState<{ start: string; end: string }>({ start: "", end: "" });

  const schoolId = profile?.school_id;

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const sess = await fetchSessions(schoolId);
      setSessions(sess);
      const termsMap: Record<string, Term[]> = {};
      for (const s of sess) {
        termsMap[s.id] = await fetchTerms(s.id);
      }
      setTermsBySession(termsMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function handleCreateSession() {
    if (!schoolId || !newSessionName.trim()) return;
    try {
      await createSession(schoolId, newSessionName.trim());
      setNewSessionName("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
    }
  }

  function pendingKey(sessionId: string, num: number) {
    return `${sessionId}:${num}`;
  }

  async function handleCreateTerm(sessionId: string, termNumber: number) {
    const key = pendingKey(sessionId, termNumber);
    const dates = pendingDates[key];
    try {
      await createTerm(sessionId, termNumber, dates?.start || null, dates?.end || null);
      setPendingDates((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create term");
    }
  }

  function startEditingTerm(term: Term) {
    setEditingTermId(term.id);
    setEditDates({ start: term.start_date ?? "", end: term.end_date ?? "" });
  }

  async function handleSaveTermDates(termId: string) {
    try {
      await updateTermDates(termId, editDates.start || null, editDates.end || null);
      setEditingTermId(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save term dates");
    }
  }

  async function handleSetCurrentSession(sessionId: string) {
    if (!schoolId) return;
    try {
      await setCurrentSession(schoolId, sessionId);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set current session");
    }
  }

  async function handleSetCurrentTerm(sessionId: string, termId: string) {
    try {
      await setCurrentTerm(sessionId, termId);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set current term");
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">Academic Sessions & Terms</h1>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder='New session, e.g. "2026/2027"'
          value={newSessionName}
          onChange={(e) => setNewSessionName(e.target.value)}
          className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
        />
        <button
          onClick={handleCreateSession}
          className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold"
        >
          Add Session
        </button>
      </div>

      <div className="space-y-4">
        {sessions.length === 0 && (
          <p className="text-forest-300 font-ui text-sm">No sessions yet — create one above.</p>
        )}

        {sessions.map((session) => {
          const terms = termsBySession[session.id] ?? [];

          return (
            <div key={session.id} className="bg-forest-900 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg text-forest-100">{session.name}</span>
                  {session.is_current && (
                    <span className="text-xs px-2 py-0.5 rounded bg-forest-500 text-forest-950 font-ui font-semibold">
                      Current
                    </span>
                  )}
                </div>
                {!session.is_current && (
                  <button
                    onClick={() => handleSetCurrentSession(session.id)}
                    className="text-xs px-3 py-1 rounded bg-forest-700 text-forest-100 font-ui"
                  >
                    Set as current
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-wrap items-start">
                {[1, 2, 3].map((num) => {
                  const term = terms.find((t) => t.term_number === num);
                  if (!term) {
                    const key = pendingKey(session.id, num);
                    const dates = pendingDates[key] ?? { start: "", end: "" };
                    return (
                      <div
                        key={num}
                        className="flex flex-col gap-1 text-xs px-3 py-2 rounded border border-forest-700"
                      >
                        <span className="text-forest-300">Term {num}</span>
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={dates.start}
                            onChange={(e) =>
                              setPendingDates((prev) => ({
                                ...prev,
                                [key]: { ...dates, start: e.target.value },
                              }))
                            }
                            className="bg-forest-700 text-forest-100 rounded px-1 py-0.5 font-ui"
                          />
                          <input
                            type="date"
                            value={dates.end}
                            onChange={(e) =>
                              setPendingDates((prev) => ({
                                ...prev,
                                [key]: { ...dates, end: e.target.value },
                              }))
                            }
                            className="bg-forest-700 text-forest-100 rounded px-1 py-0.5 font-ui"
                          />
                        </div>
                        <button
                          onClick={() => handleCreateTerm(session.id, num)}
                          className="text-forest-300 underline text-left"
                        >
                          + Add Term {num}
                        </button>
                      </div>
                    );
                  }

                  const isEditing = editingTermId === term.id;

                  return (
                    <div
                      key={term.id}
                      className="flex flex-col gap-1 text-xs px-3 py-2 rounded bg-forest-700 text-forest-100 font-ui"
                    >
                      <div className="flex items-center gap-2">
                        <span>Term {term.term_number}</span>
                        {term.is_current ? (
                          <span className="px-1.5 py-0.5 rounded bg-forest-300 text-forest-950 font-semibold">
                            Current
                          </span>
                        ) : (
                          <button onClick={() => handleSetCurrentTerm(session.id, term.id)} className="underline">
                            Set current
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <input
                              type="date"
                              value={editDates.start}
                              onChange={(e) => setEditDates((prev) => ({ ...prev, start: e.target.value }))}
                              className="bg-forest-900 text-forest-100 rounded px-1 py-0.5"
                            />
                            <input
                              type="date"
                              value={editDates.end}
                              onChange={(e) => setEditDates((prev) => ({ ...prev, end: e.target.value }))}
                              className="bg-forest-900 text-forest-100 rounded px-1 py-0.5"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveTermDates(term.id)} className="underline">
                              Save
                            </button>
                            <button onClick={() => setEditingTermId(null)} className="text-forest-300 underline">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => startEditingTerm(term)} className="text-forest-300 underline text-left">
                          {term.start_date && term.end_date
                            ? `${term.start_date} → ${term.end_date}`
                            : "Set dates"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
