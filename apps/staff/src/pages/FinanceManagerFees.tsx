import { useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { useToast } from "../features/toast/ToastContext";
import { supabase } from "../lib/supabase";
import { fetchClasses } from "../features/classes/api";
import type { SchoolClass } from "../features/classes/api";
import { fetchSchoolInfo, type FinancialModel } from "../features/schools/api";
import {
  fetchCurrentTerm,
  fetchFeeTypes,
  createFeeType,
  archiveFeeType,
  ensureQuarterlyCDS,
  fetchStudentFeeRowsForType,
  upsertStudentFee,
  type CurrentTerm,
  type FeeType,
  type StudentFeeRow,
} from "../features/fees/api";

export default function FinanceManagerFees() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [term, setTerm] = useState<CurrentTerm | null>(null);
  const [financialModel, setFinancialModel] = useState<FinancialModel>("fees");
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState<string | null>(null);
  const [rows, setRows] = useState<StudentFeeRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { due: string; paid: string }>>({});

  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [newIsOpenAmount, setNewIsOpenAmount] = useState(false);

  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const schoolId = profile?.school_id;

  async function loadFeeTypes(currentTerm: CurrentTerm) {
    if (!schoolId) return;
    const types = await fetchFeeTypes(schoolId, currentTerm.id);
    setFeeTypes(types);
  }

  async function loadRows(feeTypeId: string) {
    setRowsLoading(true);
    try {
      const feeRows = await fetchStudentFeeRowsForType(feeTypeId);
      setRows(feeRows);
      const nextDrafts: Record<string, { due: string; paid: string }> = {};
      feeRows.forEach((r) => {
        nextDrafts[r.student_id] = { due: String(r.amount_due), paid: String(r.amount_paid) };
      });
      setDrafts(nextDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load student fees");
    } finally {
      setRowsLoading(false);
    }
  }

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const [currentTerm, classList, schoolInfo] = await Promise.all([
        fetchCurrentTerm(schoolId),
        fetchClasses(schoolId),
        fetchSchoolInfo(schoolId),
      ]);
      setTerm(currentTerm);
      setClasses(classList);
      const model = schoolInfo?.financial_model ?? "fees";
      setFinancialModel(model);
      if (currentTerm) {
        if (model === "partnership") {
          await ensureQuarterlyCDS(schoolId, currentTerm.id, profile!.id);
        }
        await loadFeeTypes(currentTerm);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  // Realtime: reload the selected fee type's student rows whenever
  // student_fees changes for this school (manual edit here, or later
  // an automated payment webhook).
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`fees_page_${schoolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_fees", filter: `school_id=eq.${schoolId}` },
        () => {
          if (selectedFeeTypeId) loadRows(selectedFeeTypeId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, selectedFeeTypeId]);

  async function handleCreateFeeType() {
    if (!schoolId || !term || !newName.trim()) return;
    if (!newIsOpenAmount && !newAmount) return;
    const amount = parseFloat(newAmount) || 0;
    setCreating(true);
    setError(null);
    try {
      const createdName = newName.trim();
      await createFeeType(
        schoolId,
        term.id,
        createdName,
        amount,
        newClassId || null,
        profile!.id,
        newIsOpenAmount
      );
      setNewName("");
      setNewAmount("");
      setNewClassId("");
      setNewIsOpenAmount(false);
      await loadFeeTypes(term);
      showToast(`"${createdName}" ${isPartnership ? "support item" : "fee type"} created`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create fee type";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(feeType: FeeType, e: MouseEvent) {
    e.stopPropagation();
    if (!schoolId || !term) return;
    const itemWord = isPartnership ? "support item" : "fee";
    if (
      !window.confirm(
        `Archive "${feeType.name}"? It will stop showing here and to parents, but existing payment records for it are kept.`
      )
    ) {
      return;
    }
    setArchivingId(feeType.id);
    try {
      await archiveFeeType(feeType.id, schoolId, profile!.id);
      if (selectedFeeTypeId === feeType.id) setSelectedFeeTypeId(null);
      await loadFeeTypes(term);
      showToast(`"${feeType.name}" archived`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Failed to archive ${itemWord}`;
      setError(msg);
      showToast(msg, "error");
    } finally {
      setArchivingId(null);
    }
  }

  function selectFeeType(feeTypeId: string) {
    setSelectedFeeTypeId(feeTypeId);
    loadRows(feeTypeId);
  }

  function updateDraft(studentId: string, field: "due" | "paid", value: string) {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  }

  async function handleSave(studentId: string) {
    if (!schoolId || !term || !selectedFeeTypeId) return;
    const draft = drafts[studentId];
    const due = parseFloat(draft?.due || "0") || 0;
    const paid = parseFloat(draft?.paid || "0") || 0;
    setSavingId(studentId);
    try {
      await upsertStudentFee(schoolId, studentId, selectedFeeTypeId, term.id, due, paid, profile!.id);
      showToast("Fee record saved", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save fee";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleMarkPaid(studentId: string) {
    const draft = drafts[studentId];
    const due = parseFloat(draft?.due || "0") || 0;
    updateDraft(studentId, "paid", String(due));
    if (!schoolId || !term || !selectedFeeTypeId) return;
    setSavingId(studentId);
    try {
      await upsertStudentFee(schoolId, studentId, selectedFeeTypeId, term.id, due, due, profile!.id);
      const studentName = rows.find((r) => r.student_id === studentId)?.full_name ?? "Student";
      showToast(`${studentName} marked as paid`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to mark as paid";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  const selectedFeeType = feeTypes.find((f) => f.id === selectedFeeTypeId) ?? null;
  const isPartnership = financialModel === "partnership";
  const pageTitle = isPartnership ? "Support & Partnership" : "Fees";
  const createLabel = isPartnership ? "Create Support Item" : "Create Fee";
  const namePlaceholder = isPartnership
    ? 'Name, e.g. "Child Developmental Support"'
    : 'Fee name, e.g. "School Fees"';

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-display text-2xl text-forest-100">{pageTitle}</h1>
      {isPartnership && (
        <p className="font-ui text-xs text-forest-300 -mt-4">
          This school runs on the Partnership model. Items you create here (e.g. quarterly Child
          Developmental Support) appear to parents alongside a tier choice (Gold / Silver / Bronze)
          they pick when contributing. Gold and Silver are monetary; Bronze is a volunteer/in-kind
          commitment with no payment attached.
        </p>
      )}

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      {!term && (
        <p className="font-ui text-sm text-forest-300 bg-forest-900 rounded-lg p-3">
          No current session/term is set — ask School Admin to set one under Sessions & Terms before creating {isPartnership ? "support items" : "fees"}.
        </p>
      )}

      {term && (
        <>
          <p className="font-ui text-xs text-forest-300">
            {term.session_name} · Term {term.term_number}
          </p>

          <div className="bg-forest-900 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder={namePlaceholder}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60 flex-1"
              />
              {!newIsOpenAmount && (
                <input
                  type="number"
                  placeholder="Amount"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-32 p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
                />
              )}
              <select
                value={newClassId}
                onChange={(e) => setNewClassId(e.target.value)}
                className="p-2 rounded bg-forest-700 text-forest-100 font-ui"
              >
                <option value="">Whole School</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreateFeeType}
                disabled={creating}
                className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold whitespace-nowrap hover:bg-forest-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? "Creating..." : createLabel}
              </button>
            </div>
            {isPartnership && (
              <label className="flex items-center gap-2 font-ui text-xs text-forest-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsOpenAmount}
                  onChange={(e) => setNewIsOpenAmount(e.target.checked)}
                />
                Open contribution — no fixed amount (Gold / Silver / Bronze tiers apply instead)
              </label>
            )}
          </div>

          <div className="space-y-2">
            {feeTypes.length === 0 && (
              <p className="text-forest-300 font-ui text-sm">
                {isPartnership ? "No support items yet — create one above." : "No fee types yet — create one above."}
              </p>
            )}
            {feeTypes.map((f) => (
              <div
                key={f.id}
                onClick={() => selectFeeType(f.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") selectFeeType(f.id);
                }}
                className={`w-full text-left bg-forest-900 rounded-lg p-4 flex items-center justify-between hover:bg-forest-700 transition-colors cursor-pointer ${
                  selectedFeeTypeId === f.id ? "ring-2 ring-forest-500" : ""
                }`}
              >
                <div>
                  <p className="font-display text-forest-100">{f.name}</p>
                  <p className="font-ui text-xs text-forest-300">{f.class_name ?? "Whole School"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-ui text-forest-100">
                    {f.is_open_amount ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-forest-700 text-forest-300">
                        Open — tier-based
                      </span>
                    ) : (
                      `₦${f.amount.toLocaleString()}`
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleArchive(f, e)}
                    disabled={archivingId === f.id}
                    className="px-2 py-1 rounded text-xs font-ui text-error hover:bg-error/10 disabled:opacity-50 transition-colors"
                  >
                    {archivingId === f.id ? "Archiving..." : "Archive"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selectedFeeType && (
            <div className="space-y-3">
              <h2 className="font-display text-lg text-forest-100">
                {selectedFeeType.name} — Student Status
              </h2>
              {rowsLoading && <p className="font-ui text-sm text-forest-300">Loading...</p>}
              {!rowsLoading && rows.length === 0 && (
                <p className="font-ui text-sm text-forest-300">No students under this fee.</p>
              )}
              {!rowsLoading &&
                rows.map((row) => {
                  const draft = drafts[row.student_id] ?? { due: "0", paid: "0" };
                  return (
                    <div
                      key={row.student_id}
                      className="bg-forest-900 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="flex-1">
                        <p className="font-display text-forest-100">{row.full_name}</p>
                        <p className="font-ui text-xs text-forest-300">{row.class_name ?? "No class"}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="font-ui text-xs text-forest-300">Due</label>
                        <input
                          type="number"
                          value={draft.due}
                          onChange={(e) => updateDraft(row.student_id, "due", e.target.value)}
                          className="w-24 p-1.5 rounded bg-forest-700 text-forest-100 font-ui text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="font-ui text-xs text-forest-300">Paid</label>
                        <input
                          type="number"
                          value={draft.paid}
                          onChange={(e) => updateDraft(row.student_id, "paid", e.target.value)}
                          className="w-24 p-1.5 rounded bg-forest-700 text-forest-100 font-ui text-sm"
                        />
                      </div>

                      <span
                        className={`text-xs px-2 py-0.5 rounded font-ui font-semibold ${
                          row.is_paid ? "bg-forest-500 text-forest-950" : "bg-error text-forest-100"
                        }`}
                      >
                        {row.is_paid ? "Paid" : "Unpaid"}
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(row.student_id)}
                          disabled={savingId === row.student_id}
                          className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs hover:bg-forest-500 hover:text-forest-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => handleMarkPaid(row.student_id)}
                          disabled={savingId === row.student_id}
                          className="px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold hover:bg-forest-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Mark Paid
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
