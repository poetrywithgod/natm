import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { fetchMyClass, fetchClassStudents, type MyClass, type ClassStudent } from "../features/attendance/api";
import {
  fetchObservation,
  fetchObservationHistory,
  saveObservation,
  fetchCurrentTermNumber,
  fetchShadowTeacherNameForStudent,
  type DailyTeacherObservation,
} from "../features/observations/api";
import { CLASS_TEACHER_OBSERVATION_SECTIONS, initSections, type SectionsData, type SectionValue } from "@natm/shared-types";
import {
  SUBJECT_PERFORMANCE_SECTION_KEY,
  SUBJECT_PERFORMANCE_TITLE,
  SUBJECT_PERFORMANCE_OPTIONS,
  type RatingTableSection,
} from "@natm/shared-types";
import { fetchSubjectsForClassDay } from "../features/timetable/api";
import SectionRenderer from "../features/observations/components/SectionRenderer";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayOfWeekNumber(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getDay(); // 1=Mon..5=Fri matches timetable_entries.day_of_week
}

// Everything up to and including "Academic Learning Observation" renders
// first, then the timetable-driven Subject Performance section, then the
// rest -- so subject ratings sit right after the general academic section
// they complement.
const ACADEMIC_SECTION_INDEX = CLASS_TEACHER_OBSERVATION_SECTIONS.findIndex(
  (s) => s.key === "academic_learning"
);
const SECTIONS_BEFORE_SUBJECTS = CLASS_TEACHER_OBSERVATION_SECTIONS.slice(0, ACADEMIC_SECTION_INDEX + 1);
const SECTIONS_AFTER_SUBJECTS = CLASS_TEACHER_OBSERVATION_SECTIONS.slice(ACADEMIC_SECTION_INDEX + 1);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayLabelFor(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_NAMES[d.getDay()];
}

const inputCls =
  "w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm placeholder:text-forest-300/60 border border-transparent focus:border-forest-400 focus:outline-none";

export default function ClassTeacherActivities() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [myClass, setMyClass] = useState<MyClass | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [shadowTeacherName, setShadowTeacherName] = useState<string | null>(null);
  const [termNumber, setTermNumber] = useState<number | null>(null);
  const [week, setWeek] = useState<string>("");

  const [record, setRecord] = useState<DailyTeacherObservation | null>(null);
  const [sections, setSections] = useState<SectionsData>({});
  const [scheduledSubjects, setScheduledSubjects] = useState<{ id: string; name: string }[]>([]);
  const [teacherSignature, setTeacherSignature] = useState("");
  const [parentSignature, setParentSignature] = useState("");

  const [history, setHistory] = useState<DailyTeacherObservation[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [loadingClass, setLoadingClass] = useState(true);
  const [loadingForm, setLoadingForm] = useState(true);
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setLoadingClass(true);
    fetchMyClass(profile.id)
      .then(async (cls) => {
        setMyClass(cls);
        if (cls) {
          const [studs, term] = await Promise.all([
            fetchClassStudents(cls.id),
            profile.school_id ? fetchCurrentTermNumber(profile.school_id) : Promise.resolve(null),
          ]);
          setStudents(studs);
          setTermNumber(term);
          if (studs.length > 0) {
            const preselected = searchParams.get("student");
            setStudentId(preselected && studs.some((s) => s.id === preselected) ? preselected : studs[0].id);
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load class"))
      .finally(() => setLoadingClass(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (!studentId || !date) return;
    setLoadingForm(true);
    setError(null);
    setSuccessMessage(null);
    Promise.all([
      fetchObservation(studentId, date),
      fetchObservationHistory(studentId),
      fetchShadowTeacherNameForStudent(studentId),
      myClass ? fetchSubjectsForClassDay(myClass.id, dayOfWeekNumber(date)) : Promise.resolve([]),
    ])
      .then(([existing, hist, shadowName, subjects]) => {
        setRecord(existing);
        setHistory(hist);
        setShadowTeacherName(shadowName);
        setScheduledSubjects(subjects);
        const initial = initSections(CLASS_TEACHER_OBSERVATION_SECTIONS, existing?.sections);
        initial[SUBJECT_PERFORMANCE_SECTION_KEY] = existing?.sections?.[SUBJECT_PERFORMANCE_SECTION_KEY] ?? {
          ratings: {},
          notes: {},
        };
        setSections(initial);
        setTeacherSignature(existing?.teacher_signature ?? "");
        setParentSignature(existing?.parent_signature ?? "");
        setWeek(existing?.week != null ? String(existing.week) : "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load observation form"))
      .finally(() => setLoadingForm(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, date, myClass?.id]);

  function updateSection(key: string, value: SectionValue) {
    setSections((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(status: "draft" | "submitted") {
    if (!myClass || !profile?.school_id || !profile?.id || !studentId) return;
    setSaving(status);
    setError(null);
    setSuccessMessage(null);
    try {
      const saved = await saveObservation({
        id: record?.id,
        schoolId: profile.school_id,
        classId: myClass.id,
        studentId,
        teacherId: profile.id,
        date,
        termNumber,
        week: week.trim() ? Number(week) : null,
        dayLabel: dayLabelFor(date),
        sections,
        status,
        teacherSignature: teacherSignature.trim() || null,
        parentSignature: parentSignature.trim() || null,
        signedDate: status === "submitted" ? date : record?.signed_date ?? null,
      });
      setRecord(saved);
      setSuccessMessage(status === "submitted" ? "Form submitted." : "Draft saved.");
      const hist = await fetchObservationHistory(studentId);
      setHistory(hist);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save form");
    } finally {
      setSaving(null);
    }
  }

  if (loadingClass) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  if (!myClass) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl text-forest-100">Daily Activities</h1>
        <p className="font-ui text-sm text-forest-300 mt-2">
          You're not currently assigned to a class. Contact your School Admin.
        </p>
      </div>
    );
  }

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Daily Teacher Observation Form</h1>
        <p className="font-ui text-xs text-forest-300">{myClass.name} · 8:00 AM – 3:00 PM</p>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {successMessage && <p className="font-ui text-sm text-forest-300">{successMessage}</p>}

      {students.length === 0 ? (
        <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
          No students are in your class yet.
        </p>
      ) : (
        <>
          {/* Learner Information */}
          <section className="bg-forest-900 rounded-lg p-4 space-y-3">
            <h2 className="font-ui text-sm font-semibold text-forest-100">Learner Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="obs-student" className="font-ui text-[11px] text-forest-300">
                  Learner Name
                </label>
                <select
                  id="obs-student"
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
                <label htmlFor="obs-date" className="font-ui text-[11px] text-forest-300">
                  Date
                </label>
                <input
                  id="obs-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Class</span>
                <p className="font-ui text-sm text-forest-100 p-2">{myClass.name}</p>
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Teacher</span>
                <p className="font-ui text-sm text-forest-100 p-2">{profile?.full_name}</p>
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Shadow Teacher</span>
                <p className="font-ui text-sm text-forest-100 p-2">{shadowTeacherName ?? "Not assigned"}</p>
              </div>
              <div>
                <span className="font-ui text-[11px] text-forest-300">Term</span>
                <p className="font-ui text-sm text-forest-100 p-2">
                  {termNumber ? `${termNumber === 1 ? "First" : termNumber === 2 ? "Second" : "Third"} Term` : "—"}
                </p>
              </div>
              <div>
                <label htmlFor="obs-week" className="font-ui text-[11px] text-forest-300">
                  Week
                </label>
                <input
                  id="obs-week"
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
            </div>
          </section>

          {loadingForm ? (
            <p className="font-ui text-sm text-forest-300">Loading form...</p>
          ) : (
            <>
              {record?.status === "submitted" && (
                <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
                  This form was submitted for {selectedStudent?.full_name} on {date}. You can still update it below.
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
                    <label htmlFor="obs-teacher-sig" className="font-ui text-[11px] text-forest-300">
                      Teacher Signature (type full name)
                    </label>
                    <input
                      id="obs-teacher-sig"
                      type="text"
                      value={teacherSignature}
                      onChange={(e) => setTeacherSignature(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="obs-parent-sig" className="font-ui text-[11px] text-forest-300">
                      Parent Signature (type full name)
                    </label>
                    <input
                      id="obs-parent-sig"
                      type="text"
                      value={parentSignature}
                      onChange={(e) => setParentSignature(e.target.value)}
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
                  {saving === "submitted" ? "Submitting..." : "Submit Form"}
                </button>
              </div>

              <div>
                <button
                  onClick={() => setShowHistory((s) => !s)}
                  className="font-ui text-xs text-forest-300 hover:text-forest-100 underline"
                >
                  {showHistory ? "Hide" : "Show"} past forms for {selectedStudent?.full_name}
                </button>
                {showHistory && (
                  <div className="space-y-2 mt-2">
                    {history.length === 0 && (
                      <p className="font-ui text-sm text-forest-300">No past forms yet.</p>
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
