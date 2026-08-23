import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchEpisodeDetail,
  approveForm1,
  generateRecommendation,
  approveRecommendation,
  fetchClassOptions,
  fetchShadowTeacherOptions,
  assignClass,
  assignShadowTeacher,
  type EpisodeDetail,
  type SuggestedSubject,
  type ClassOption,
  type ShadowTeacherOption,
} from "../features/assessments/api";
import type { Database } from "@natm/supabase";

type ClassLevel = Database["public"]["Enums"]["class_level"];

const CLASS_LEVELS = [
  "primary_1", "primary_2", "primary_3", "primary_4", "primary_5", "primary_6",
  "jss_1", "jss_2", "jss_3",
  "ss_1", "ss_2", "ss_3",
];

function levelLabel(level: string): string {
  if (level.startsWith("primary_")) return `Primary ${level.split("_")[1]}`;
  if (level.startsWith("jss_")) return `JSS ${level.split("_")[1]}`;
  if (level.startsWith("ss_")) return `SS ${level.split("_")[1]}`;
  return level;
}

function prettyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-forest-300 italic">—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-forest-300 italic">—</span>;
    return <span className="text-forest-100">{value.map(String).join(", ")}</span>;
  }
  if (typeof value === "object") {
    return (
      <div className="pl-3 border-l border-forest-700 space-y-1 mt-1">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <span className="text-forest-300 font-ui text-xs">{prettyLabel(k)}: </span>
            <JsonValue value={v} />
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-forest-100">{String(value)}</span>;
}

function JsonSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  return (
    <div className="bg-forest-900 rounded-lg p-4 space-y-3">
      <h2 className="font-display text-lg text-forest-100">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-forest-300 font-ui text-sm">No data recorded.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key}>
              <p className="font-ui text-sm text-forest-100 font-semibold">{prettyLabel(key)}</p>
              <JsonValue value={value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminIntakeReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approvingRec, setApprovingRec] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [selectedLevel, setSelectedLevel] = useState<string>("");

  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [shadowTeacherOptions, setShadowTeacherOptions] = useState<ShadowTeacherOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedShadowTeacherId, setSelectedShadowTeacherId] = useState<string>("");
  const [assigningClass, setAssigningClass] = useState(false);
  const [assigningShadowTeacher, setAssigningShadowTeacher] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const d = await fetchEpisodeDetail(id);
      setDetail(d);
      if (d.status === "ai_suggested" || d.status === "completed") {
        const subjects = d.approvedSubjects ?? d.suggestedSubjects;
        setSelectedSubjectIds(new Set(subjects.map((s) => s.subject_id)));
        setSelectedLevel(d.approvedLevel ?? d.suggestedLevel ?? "");
      }
      if (d.status === "completed" && profile?.school_id) {
        const [classes, shadowTeachers] = await Promise.all([
          fetchClassOptions(profile.school_id),
          fetchShadowTeacherOptions(profile.school_id),
        ]);
        setClassOptions(classes);
        setShadowTeacherOptions(shadowTeachers);
        const matchingClass = classes.find((c) => c.level === d.approvedLevel);
        setSelectedClassId(d.currentClassId ?? matchingClass?.id ?? "");
        setSelectedShadowTeacherId(d.currentShadowTeacherId ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load submission");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleApprove() {
    if (!detail || !profile?.id) return;
    setApproving(true);
    setError(null);
    try {
      await approveForm1(detail.episodeId, profile.id);
      navigate("/admin/intake");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve submission");
    } finally {
      setApproving(false);
    }
  }

  async function handleGenerateRecommendation() {
    if (!detail) return;
    setGenerating(true);
    setError(null);
    try {
      await generateRecommendation(detail.episodeId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate recommendation");
    } finally {
      setGenerating(false);
    }
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjectIds((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }

  async function handleApproveRecommendation() {
    if (!detail || !profile?.id || !profile?.school_id || !selectedLevel) return;
    setApprovingRec(true);
    setError(null);
    try {
      const approvedSubjects: SuggestedSubject[] = detail.suggestedSubjects.filter((s) =>
        selectedSubjectIds.has(s.subject_id)
      );
      await approveRecommendation(
        detail.episodeId,
        detail.studentId,
        profile.school_id,
        approvedSubjects,
        selectedLevel as ClassLevel,
        profile.id
      );
      navigate("/admin/intake");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve recommendation");
    } finally {
      setApprovingRec(false);
    }
  }

  async function handleAssignClass() {
    if (!detail || !profile?.id || !profile?.school_id || !selectedClassId) return;
    setAssigningClass(true);
    setError(null);
    try {
      await assignClass(detail.episodeId, detail.studentId, selectedClassId, profile.school_id, profile.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign class");
    } finally {
      setAssigningClass(false);
    }
  }

  async function handleAssignShadowTeacher() {
    if (!detail || !profile?.id || !profile?.school_id || !selectedShadowTeacherId) return;
    setAssigningShadowTeacher(true);
    setError(null);
    try {
      await assignShadowTeacher(
        detail.episodeId,
        detail.studentId,
        selectedShadowTeacherId,
        profile.school_id,
        profile.id
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign shadow teacher");
    } finally {
      setAssigningShadowTeacher(false);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;
  if (!detail) return <div className="p-6 font-ui text-forest-100">Submission not found.</div>;

  const canApprove = detail.status === "form1_submitted";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-forest-100">{detail.studentName}</h1>
          <p className="font-ui text-xs text-forest-300 mt-0.5">
            ID: {detail.uniqueStudentId} — Episode {detail.episodeNumber} — Status: {detail.status}
          </p>
        </div>
        {canApprove ? (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold disabled:opacity-50"
          >
            {approving ? "Approving..." : "Approve Form 1"}
          </button>
        ) : (
          <span className="px-3 py-1.5 rounded bg-forest-700 text-forest-300 font-ui text-xs">
            {detail.status === "form1_approved" ? "Already approved" : detail.status}
          </span>
        )}
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}

      <div className="bg-forest-900 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="font-display text-lg text-forest-100">Form 2 — Physical Assessment</p>
          <p className="font-ui text-xs text-forest-300 mt-0.5">
            {detail.status === "form1_submitted"
              ? "Locked until Form 1 is approved."
              : "Complete this with the student during the scheduled observation."}
          </p>
        </div>
        {detail.status === "form1_submitted" ? (
          <span className="px-3 py-1.5 rounded bg-forest-700 text-forest-300 font-ui text-xs">
            🔒 Locked — approve Form 1 first
          </span>
        ) : (
          <Link
            to={`/admin/intake/${detail.episodeId}/observation`}
            className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold"
          >
            {detail.status === "form1_approved" ? "Begin Form 2" : "Continue Form 2"}
          </Link>
        )}
      </div>

      {(detail.status === "form2_submitted" ||
        detail.status === "ai_suggested" ||
        detail.status === "completed") && (
        <div className="bg-forest-900 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg text-forest-100">AI Recommendation</p>
            {detail.status === "form2_submitted" && (
              <button
                onClick={handleGenerateRecommendation}
                disabled={generating}
                className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Recommendation"}
              </button>
            )}
            {detail.status === "completed" && (
              <span className="px-3 py-1.5 rounded bg-forest-700 text-forest-300 font-ui text-xs">
                Approved
              </span>
            )}
          </div>

          {(detail.status === "ai_suggested" || detail.status === "completed") && (
            <>
              {detail.suggestedSummary && (
                <p className="font-ui text-sm text-forest-300">{detail.suggestedSummary}</p>
              )}

              <div>
                <p className="font-ui text-xs font-semibold text-forest-300 mb-1">Class Level</p>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  disabled={detail.status === "completed"}
                  className="w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100 disabled:opacity-60"
                >
                  {CLASS_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {levelLabel(level)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="font-ui text-xs font-semibold text-forest-300">Subjects</p>
                {detail.suggestedSubjects.map((s) => (
                  <label
                    key={s.subject_id}
                    className="flex items-start gap-3 bg-forest-950 rounded-md p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.has(s.subject_id)}
                      onChange={() => toggleSubject(s.subject_id)}
                      disabled={detail.status === "completed"}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-ui text-sm text-forest-100 font-semibold">{s.subject_name}</p>
                      <p className="font-ui text-xs text-forest-300 mt-0.5">{s.rationale}</p>
                    </div>
                  </label>
                ))}
              </div>

              {detail.status === "ai_suggested" && (
                <button
                  onClick={handleApproveRecommendation}
                  disabled={approvingRec || selectedSubjectIds.size === 0}
                  className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
                >
                  {approvingRec ? "Approving..." : "Approve & Assign Subjects"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {detail.status === "completed" && (
        <div className="bg-forest-900 rounded-lg p-4 space-y-4">
          <p className="font-display text-lg text-forest-100">Assign Class</p>
          {detail.classAssignedAt ? (
            <div className="flex items-center justify-between">
              <p className="font-ui text-sm text-forest-100">
                Assigned to <span className="font-semibold">{detail.currentClassName ?? "—"}</span>
              </p>
              <span className="px-3 py-1.5 rounded bg-forest-700 text-forest-300 font-ui text-xs">Assigned</span>
            </div>
          ) : (
            <>
              <p className="font-ui text-xs text-forest-300">
                Suggested from the approved level ({detail.approvedLevel ? levelLabel(detail.approvedLevel) : "—"}).
                Override if needed.
              </p>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100"
              >
                <option value="">Select a class...</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.level ? ` (${levelLabel(c.level)})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignClass}
                disabled={assigningClass || !selectedClassId}
                className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
              >
                {assigningClass ? "Assigning..." : "Assign Class"}
              </button>
            </>
          )}
        </div>
      )}

      {detail.status === "completed" && (
        <div className="bg-forest-900 rounded-lg p-4 space-y-4">
          <p className="font-display text-lg text-forest-100">Assign Shadow Teacher</p>
          {!detail.classAssignedAt ? (
            <span className="px-3 py-1.5 rounded bg-forest-700 text-forest-300 font-ui text-xs">
              🔒 Locked — assign a class first
            </span>
          ) : detail.shadowTeacherAssignedAt ? (
            <div className="flex items-center justify-between">
              <p className="font-ui text-sm text-forest-100">
                Assigned to <span className="font-semibold">{detail.currentShadowTeacherName ?? "—"}</span>
              </p>
              <span className="px-3 py-1.5 rounded bg-forest-700 text-forest-300 font-ui text-xs">Assigned</span>
            </div>
          ) : (
            <>
              <select
                value={selectedShadowTeacherId}
                onChange={(e) => setSelectedShadowTeacherId(e.target.value)}
                className="w-full rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100"
              >
                <option value="">Select a shadow teacher...</option>
                {shadowTeacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} — {t.activeStudentCount} student{t.activeStudentCount === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignShadowTeacher}
                disabled={assigningShadowTeacher || !selectedShadowTeacherId}
                className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
              >
                {assigningShadowTeacher ? "Assigning..." : "Assign Shadow Teacher"}
              </button>
            </>
          )}
        </div>
      )}

      <JsonSection title="Part A — Intake & Consent" data={detail.partA} />
      <JsonSection title="Part B — Functional Domains" data={detail.partB} />
      <JsonSection title="Consents" data={detail.consents} />
    </div>
  );
}
