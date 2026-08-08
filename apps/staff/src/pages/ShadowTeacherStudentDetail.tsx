import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchStudentInfo,
  fetchStudentAttendance,
  fetchOfferedSubjects,
  fetchSubjectProgress,
  fetchActivityFeed,
  saveReinforcementNote,
  type StudentInfo,
  type AttendanceSummary,
  type OfferedSubject,
  type SubjectProgress,
  type ActivityFeedItem,
} from "../features/shadowteacher/api";
import { getSignedPhotoUrl } from "../features/students/api";

export default function ShadowTeacherStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [subjects, setSubjects] = useState<OfferedSubject[]>([]);
  const [progress, setProgress] = useState<SubjectProgress[]>([]);
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const info = await fetchStudentInfo(id);
        if (cancelled) return;
        setStudent(info);

        if (info?.photo_url) {
          getSignedPhotoUrl(info.photo_url).then((url) => {
            if (!cancelled) setPhotoUrl(url);
          });
        }

        const [attendanceData, progressData] = await Promise.all([
          fetchStudentAttendance(id),
          fetchSubjectProgress(id),
        ]);
        if (cancelled) return;
        setAttendance(attendanceData);
        setProgress(progressData);

        if (info?.class_id) {
          const [subjectsData, feedData] = await Promise.all([
            fetchOfferedSubjects(info.class_id),
            fetchActivityFeed(info.class_id, id),
          ]);
          if (cancelled) return;
          setSubjects(subjectsData);
          setFeed(feedData);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load student");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSaveNote(activityId: string) {
    if (!id || !profile?.id) return;
    const note = noteDrafts[activityId]?.trim();
    if (!note) return;
    setSavingId(activityId);
    try {
      await saveReinforcementNote(activityId, id, profile.id, note);
      setFeed((prev) =>
        prev.map((item) =>
          item.id === activityId
            ? {
                ...item,
                reinforcement: { id: item.reinforcement?.id ?? "", note, created_at: new Date().toISOString() },
              }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="p-4 font-ui text-forest-100">Loading...</div>;
  if (!student) return <div className="p-4 font-ui text-forest-300">Student not found.</div>;

  return (
    <div className="p-4 space-y-6">
      {error && <p className="text-error font-ui text-sm">{error}</p>}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-forest-800 overflow-hidden flex items-center justify-center text-forest-300 font-ui text-sm shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            student.full_name.charAt(0)
          )}
        </div>
        <div>
          <h1 className="font-display text-lg text-forest-100">{student.full_name}</h1>
          <p className="font-ui text-xs text-forest-300">{student.class_name ?? "No class"}</p>
        </div>
      </div>

      {/* Attendance */}
      {attendance && (
        <section className="space-y-2">
          <h2 className="font-ui text-sm font-semibold text-forest-100">Attendance (last 30)</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-forest-900 rounded-lg p-3 text-center">
              <p className="font-display text-lg text-forest-100">{attendance.present}</p>
              <p className="font-ui text-[11px] text-forest-300">Present</p>
            </div>
            <div className="bg-forest-900 rounded-lg p-3 text-center">
              <p className="font-display text-lg text-forest-100">{attendance.absent}</p>
              <p className="font-ui text-[11px] text-forest-300">Absent</p>
            </div>
            <div className="bg-forest-900 rounded-lg p-3 text-center">
              <p className="font-display text-lg text-forest-100">{attendance.late}</p>
              <p className="font-ui text-[11px] text-forest-300">Late</p>
            </div>
          </div>
        </section>
      )}

      {/* Subjects offered */}
      {subjects.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-ui text-sm font-semibold text-forest-100">Subjects offered</h2>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <span
                key={s.id}
                className="px-2.5 py-1 rounded-full bg-forest-800 text-forest-100 font-ui text-xs"
              >
                {s.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Subject progress */}
      {progress.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-ui text-sm font-semibold text-forest-100">Subject progress</h2>
          <div className="space-y-2">
            {progress.map((p) => (
              <div key={p.subject_id}>
                <div className="flex justify-between font-ui text-xs text-forest-300 mb-1">
                  <span>{p.subject_name}</span>
                  <span>{Math.round(p.average_score)}%</span>
                </div>
                <div className="h-2 rounded-full bg-forest-800 overflow-hidden">
                  <div
                    className="h-full bg-forest-500"
                    style={{ width: `${Math.min(100, Math.max(0, p.average_score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Activity feed + reinforcement notes */}
      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Activity feed</h2>
        {feed.length === 0 && (
          <p className="font-ui text-sm text-forest-300">No activities logged yet.</p>
        )}
        <div className="space-y-3">
          {feed.map((item) => (
            <div key={item.id} className="bg-forest-900 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-ui text-sm text-forest-100">{item.topic}</p>
                  <p className="font-ui text-xs text-forest-400">{item.subject_name}</p>
                </div>
                <span className="font-ui text-[11px] text-forest-400 whitespace-nowrap">
                  {new Date(item.date).toLocaleDateString()}
                </span>
              </div>
              {item.notes && <p className="font-ui text-xs text-forest-300">{item.notes}</p>}

              {item.reinforcement ? (
                <div className="bg-forest-800 rounded p-2">
                  <p className="font-ui text-[11px] text-forest-400 mb-0.5">Your reinforcement note</p>
                  <p className="font-ui text-xs text-forest-100">{item.reinforcement.note}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <textarea
                    value={noteDrafts[item.id] ?? ""}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Add a reinforcement note..."
                    rows={2}
                    className="w-full px-2 py-1.5 rounded bg-forest-950 border border-forest-700 text-forest-100 font-ui text-xs"
                  />
                  <button
                    onClick={() => handleSaveNote(item.id)}
                    disabled={savingId === item.id || !noteDrafts[item.id]?.trim()}
                    className="px-2.5 py-1 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold disabled:opacity-50"
                  >
                    {savingId === item.id ? "Saving..." : "Save note"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
