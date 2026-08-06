import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchMyClass, type MyClass } from "../features/attendance/api";
import { fetchClassSubjects, type ClassSubject } from "../features/subjects/api";
import {
  fetchClassActivities,
  createClassActivity,
  type ClassActivity,
} from "../features/activities/api";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClassTeacherActivities() {
  const { profile } = useAuth();
  const [myClass, setMyClass] = useState<MyClass | null>(null);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [activities, setActivities] = useState<ClassActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [date, setDate] = useState(todayISO());
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");

  async function loadAll() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const cls = await fetchMyClass(profile.id);
      setMyClass(cls);
      if (cls) {
        const [subs, acts] = await Promise.all([
          fetchClassSubjects(cls.id),
          fetchClassActivities(cls.id),
        ]);
        setSubjects(subs);
        setActivities(acts);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleSave() {
    if (!myClass || !profile?.school_id || !subjectId || !topic.trim()) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await createClassActivity(
        profile.school_id,
        myClass.id,
        subjectId,
        date,
        topic.trim(),
        notes.trim() || null,
        profile.id
      );
      setTopic("");
      setNotes("");
      setSuccessMessage("Activity logged.");
      const acts = await fetchClassActivities(myClass.id);
      setActivities(acts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log activity");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

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

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Daily Activities</h1>
        <p className="font-ui text-xs text-forest-300">{myClass.name}</p>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {successMessage && <p className="font-ui text-sm text-forest-300">{successMessage}</p>}

      {subjects.length === 0 ? (
        <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
          No subjects have been assigned to your class yet — ask your School Admin to add some under
          Classes.
        </p>
      ) : (
        <div className="bg-forest-900 rounded-lg p-4 space-y-3">
          <h2 className="font-ui text-sm font-semibold text-forest-100">Log today's activity</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
            />
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm flex-1"
            >
              <option value="">Select subject</option>
              {subjects.map((cs) => (
                <option key={cs.subject_id} value={cs.subject_id}>
                  {cs.subject.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Topic covered today"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm placeholder:text-forest-300/60"
          />
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm placeholder:text-forest-300/60"
          />
          <button
            onClick={handleSave}
            disabled={saving || !subjectId || !topic.trim()}
            className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Log Activity"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Recent activities</h2>
        {activities.length === 0 && (
          <p className="font-ui text-sm text-forest-300">No activities logged yet.</p>
        )}
        {activities.map((a) => (
          <div key={a.id} className="bg-forest-900 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs text-forest-300">{a.date}</span>
              <span className="font-ui text-xs px-2 py-0.5 rounded bg-forest-700 text-forest-100">
                {a.subject_name}
              </span>
            </div>
            <p className="font-display text-forest-100 mt-1">{a.topic}</p>
            {a.notes && <p className="font-ui text-sm text-forest-300 mt-1">{a.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
