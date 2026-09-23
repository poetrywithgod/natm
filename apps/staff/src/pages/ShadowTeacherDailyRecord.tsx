import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { fetchMyStudents, type MyStudent } from "../features/shadowteacher/api";
import { fetchCurrentTermNumber } from "../features/observations/api";
import {
  fetchShadowRecord,
  fetchShadowRecordHistory,
  saveShadowRecord,
  fetchClassTeacherName,
  type ShadowTeacherDailyRecord,
} from "../features/shadowRecords/api";
import { SHADOW_TEACHER_RECORD_SECTIONS, initSections, type SectionsData, type SectionValue } from "@natm/shared-types";
import {
  SUBJECT_PERFORMANCE_SECTION_KEY,
  SUBJECT_PERFORMANCE_TITLE,
  SUBJECT_PERFORMANCE_OPTIONS,
  type RatingTableSection,
} from "@natm/shared-types";
import { fetchSubjectsForClassDay } from "../features/timetable/api";
import SectionRenderer from "../features/observations/components/SectionRenderer";
import { getFriendlyErrorMessage } from "@natm/supabase";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayOfWeekNumber(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getDay(); // 1=Mon..5=Fri matches timetable_entries.day_of_week
}

// Subject Performance slots in right where the Academic Support section
// starts, ahead of the general learning-skills rating.
const ACADEMIC_SECTION_INDEX = SHADOW_TEACHER_RECORD_SECTIONS.findIndex(
  (s) => s.key === "academic_support_skills"
);
const SECTIONS_BEFORE_SUBJECTS = SHADOW_TEACHER_RECORD_SECTIONS.slice(0, ACADEMIC_SECTION_INDEX);
const SECTIONS_AFTER_SUBJECTS = SHADOW_TEACHER_RECORD_SECTIONS.slice(ACADEMIC_SECTION_INDEX);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayLabelFor(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_NAMES[d.getDay()];
}

const inputCls =
  "w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm placeholder:text-forest-300/60 border border-transparent focus:border-forest-400 focus:outline-none";

export default function ShadowTeacherDailyRecord() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<MyStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [classTeacherName, setClassTeacherName] = useState<string | null>(null);
  const [termNumber, setTermNumber] = useState<number | null>(null);
  const [week, setWeek] = useState<string>("");
  const [therapistInvolved, setTherapistInvolved] = useState("");

  const [record, setRecord] = useState<ShadowTeacherDailyRecord | null>(null);
  const [sections, setSections] = useState<SectionsData>({});
  const [scheduledSubjects, setScheduledSubjects] = useState<{ id: string; name: string }[]>([]);
  const [shadowSignature, setShadowSignature] = useState("");
  const [classTeacherSignature, setClassTeacherSignature] = useState("");

  const [history, setHistory] = useState<ShadowTeacherDailyRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingForm, setLoadingForm] = useState(true);
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    setLoadingStudents(true);
    Promise.all([
      fetchMyStudents(profile.id),
      profile.school_id ? fetchCurrentTermNumber(profile.school_id) : Promise.resolve(null),
    ])
      .then(([studs, term]) => {
        setStudents(studs);
        setTermNumber(term);
        if (studs.length > 0) {
          const preselected = searchParams.get("student");
          setStudentId(preselected && studs.some((s) => s.id === preselected) ? preselected : studs[0].id);
        }
      })
      .catch((e) => setError(getFriendlyErrorMessage(e, "Failed to load students")))
      .finally(() => setLoadingStudents(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const selectedStudent = students.find((s) => s.id === studentId);

  useEffect(() => {
    if (!studentId || !date || !selectedStudent?.class_id) return;
    setLoadingForm(true);
    setError(null);
    setSuccessMessage(null);
    Promise.all([
      fetchShadowRecord(studentId, date),
      fetchShadowRecordHistory(studentId),
      fetchClassTeacherName(selectedStudent.class_id),
      fetchSubjectsForClassDay(selectedStudent.class_id, dayOfWeekNumber(date)),
    ])
      .then(([existing, hist, teacherName, subjects]) => {
        setRecord(existing);
        setHistory(hist);
        setClassTeacherName(teacherName);
        setScheduledSubjects(subjects);
        const initial = initSections(SHADOW_TEACHER_RECORD_SECTIONS, existing?.sections);
        initial[SUBJECT_PERFORMANCE_SECTION_KEY] = existing?.sections?.[SUBJECT_PERFORMANCE_SECTION_KEY] ?? {
          ratings: {},
          notes: {},
        };
        setSections(initial);
        setShadowSignature(existing?.shadow_signature ?? "");
        setClassTeacherSignature(existing?.class_teacher_signature ?? "");
        setWeek(existing?.week != null ? String(existing.week) : "");
        setTherapistInvolved(existing?.therapist_involved ?? "");
      })
      .catch((e) => setError(getFriendlyErrorMessage(e, "Failed to load record")))
      .finally(() => setLoadingForm(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, date, selectedStudent?.class_id]);

  function updateSection(key: string, value: SectionValue) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(status: "draft" | "submitted") {
    if (!profile?.school_id || !profile?.id || !studentId || !selectedStudent?.class_id) return;
    setSaving(status);
    setError(null);
    setSuccessMessage(null);
    try {
      const saved = await saveShadowRecord({
        id: record?.id,
        schoolId: profile.school_id,
        classId: selectedStudent.class_id,
        studentId,
        shadowTeacherId: profile.id,
        therapistInvolved: therapistInvolved.trim() || null,
        date,
        termNumber,
        week: week.trim() ? Number(week) : null,
        dayLabel: dayLabelFor(date),
        sections,
        status,
        shadowSignature: shadowSignature.trim() || null,
        classTeacherSignature: classTeacherSignature.trim() || null,
        signedDate: status === "submitted" ? date : record?.signed_date ?? null,
      });
      setRecord(saved);
      setSuccessMessage(status === "submitted" ? "Record submitted." : "Draft saved.");
      const hist = await fetchShadowRecordHistory(studentId);
      setHistory(hist);
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to save record"));
    } finally {
      setSaving(null);
    }
  }

  if (loadingStudents) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Daily Support & Intervention Record</h1>
        <p className="font-ui text-xs text-forest-300">8:00 AM – 3:00 PM</p>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {successMessage && <p className="font-ui text-sm text-forest-300">{successMessage}</p>}

      {students.length === 0 ? (
        <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
          You have no assigned students yet. Contact your School Admin.
        </p>
      ) : (
        <>
          {/* Section A: Learner Information */}
          <section className="bg-forest-900 rounded-lg p-4 space-y-3">
            <h2 className="font-ui text-sm font-semibold text-forest-100">Section A: Learner Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="rec-student" className="font-ui text-[11px] text-forest-300">
                  Learner Name
                </label>
                <select
                  id="rec-student"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className={inputCls}
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rec-date" className="font-ui text-[11px] text-forest-300">
                  Date
                </label>
                <input
                  id="rec-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Class</span>
                <p className="font-ui text-sm text-forest-100 p-2">{selectedStudent?.class_name ?? "—"}</p>
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Term</span>
                <p className="font-ui text-sm text-forest-100 p-2">
                  {termNumber ? `${termNumber === 1 ? "First" : termNumber === 2 ? "Second" : "Third"} Term` : "—"}
                </p>
              </div>
              <div>
                <label htmlFor="rec-week" className="font-ui text-[11px] text-forest-300">
                  Week
                </label>
                <input
                  id="rec-week"
                  type="number"
                  min={1}
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Day</span>
                <p className="font-ui text-sm text-forest-100 p-2">{dayLabelFor(date)}</p>
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Shadow Teacher Name</span>
                <p className="font-ui text-sm text-forest-100 p-2">{profile?.full_name}</p>
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Class Teacher</span>
                <p className="font-ui text-sm text-forest-100 p-2">{classTeacherName ?? "Not assigned"}</p>
              </div>
              <div>
                <label htmlFor="rec-therapist" className="font-ui text-[11px] text-forest-300">
                  Therapist Involved
                </label>
                <input
                  id="rec-therapist"
                  type="text"
                  value={therapistInvolved}
                  onChange={(e) => setTherapistInvolved(e.target.value)}
                  placeholder="Optional"
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {loadingForm ? (
            <p className="font-ui text-sm text-forest-300">Loading form...</p>
          ) : (
            <>
              {record?.status === "submitted" && (
                <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
                  This record was submitted for {selectedStudent?.full_name} on {date}. You can still update it below.
                </p>
              )}

              {SECTIONS_BEFORE_SUBJECTS.map((config) => (
                <SectionRenderer
                  key={config.key}
                  config={config}
                  value={sections[config.key]}
                  onChange={(v) => updateSection(config.key, v)}
                />
              ))}

              <SectionRenderer
                config={
                  {
                    type: "ratingTable",
                    key: SUBJECT_PERFORMANCE_SECTION_KEY,
                    title: SUBJECT_PERFORMANCE_TITLE,
                    timeLabel:
                      scheduledSubjects.length > 0
                        ? "Based on today's timetable"
                        : "No subjects timetabled for this class today",
                    options: SUBJECT_PERFORMANCE_OPTIONS,
                    rows: scheduledSubjects.map((s) => ({ key: s.id, label: s.name })),
                  } satisfies RatingTableSection
                }
                value={sections[SUBJECT_PERFORMANCE_SECTION_KEY] ?? { ratings: {}, notes: {} }}
                onChange={(v) => updateSection(SUBJECT_PERFORMANCE_SECTION_KEY, v)}
              />

              {SECTIONS_AFTER_SUBJECTS.map((config) => (
                <SectionRenderer
                  key={config.key}
                  config={config}
                  value={sections[config.key]}
                  onChange={(v) => updateSection(config.key, v)}
                />
              ))}

              <section className="bg-forest-900 rounded-lg p-4 space-y-3">
                <h2 className="font-ui text-sm font-semibold text-forest-100">Signatures</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="rec-shadow-sig" className="font-ui text-[11px] text-forest-300">
                      Shadow Teacher Signature (type full name)
                    </label>
                    <input
                      id="rec-shadow-sig"
                      type="text"
                      value={shadowSignature}
                      onChange={(e) => setShadowSignature(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="rec-teacher-sig" className="font-ui text-[11px] text-forest-300">
                      Class Teacher Signature (type full name)
                    </label>
                    <input
                      id="rec-teacher-sig"
                      type="text"
                      value={classTeacherSignature}
                      onChange={(e) => setClassTeacherSignature(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </section>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSave("draft")}
                  disabled={saving !== null}
                  className="px-4 py-2 rounded bg-forest-700 text-forest-100 font-ui text-sm font-semibold disabled:opacity-50"
                >
                  {saving === "draft" ? "Saving..." : "Save Draft"}
                </button>
                <button
                  onClick={() => handleSave("submitted")}
                  disabled={saving !== null}
                  className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
                >
                  {saving === "submitted" ? "Submitting..." : "Submit Record"}
                </button>
              </div>

              <div>
                <button
                  onClick={() => setShowHistory((s) => !s)}
                  className="font-ui text-xs text-forest-300 hover:text-forest-100 underline"
                >
                  {showHistory ? "Hide" : "Show"} past records for {selectedStudent?.full_name}
                </button>
                {showHistory && (
                  <div className="space-y-2 mt-2">
                    {history.length === 0 && (
                      <p className="font-ui text-sm text-forest-300">No past records yet.</p>
                    )}
                    {history.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => setDate(h.date)}
                        className="w-full text-left bg-forest-900 rounded-lg p-3 flex items-center justify-between hover:bg-forest-800"
                      >
                        <span className="font-ui text-xs text-forest-300">{h.date}</span>
                        <span className="font-ui text-xs px-2 py-0.5 rounded bg-forest-700 text-forest-100 capitalize">
                          {h.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
