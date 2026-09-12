import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Megaphone, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchMyStudents,
  fetchSubjectAverages,
  type MyStudent,
  type SubjectAverage,
} from "../features/shadowteacher/api";
import { fetchShadowRecordsSince } from "../features/shadowRecords/api";
import { SHADOW_TEACHER_RECORD_SECTIONS, computeRosterProgress, type StudentRosterScore } from "@natm/shared-types";

function scoreBadgeColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-error";
}

export default function ShadowTeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<MyStudent[]>([]);
  const [averages, setAverages] = useState<SubjectAverage[]>([]);
  const [roster, setRoster] = useState<StudentRosterScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    setLoading(true);

    fetchMyStudents(profile.id)
      .then(async (list) => {
        if (cancelled) return;
        setStudents(list);
        const since = new Date();
        since.setDate(since.getDate() - 13);
        const [avgData, records] = await Promise.all([
          fetchSubjectAverages(list.map((s) => s.id)),
          fetchShadowRecordsSince(profile.id, since.toISOString().slice(0, 10)),
        ]);
        if (!cancelled) {
          setAverages(avgData);
          setRoster(
            computeRosterProgress(
              SHADOW_TEACHER_RECORD_SECTIONS,
              records.map((r) => ({ studentId: r.student_id, date: r.date, sections: r.sections }))
            )
          );
        }
      })
      .catch((err) => console.error("Failed to load dashboard:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (loading) return <div className="p-4 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="font-display text-xl text-forest-100">Welcome back, {profile?.full_name?.split(" ")[0]}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/shadow-teacher/students")}
          className="bg-forest-900 rounded-lg p-4 text-left space-y-1"
        >
          <Users size={20} className="text-forest-300" />
          <p className="font-display text-lg text-forest-100">{students.length}</p>
          <p className="font-ui text-xs text-forest-300">Students</p>
        </button>
        <button
          onClick={() => navigate("/shadow-teacher/announcements")}
          className="bg-forest-900 rounded-lg p-4 text-left space-y-1"
        >
          <Megaphone size={20} className="text-forest-300" />
          <p className="font-ui text-sm text-forest-100">Announcements</p>
          <p className="font-ui text-xs text-forest-300">View updates</p>
        </button>
      </div>

      {averages.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-ui text-sm font-semibold text-forest-100">
            Average subject performance
          </h2>
          <div className="bg-forest-900 rounded-lg p-3" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={averages} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                <XAxis
                  dataKey="subject_name"
                  tick={{ fill: "#9CA3AF", fontSize: 10 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis domain={[0, 100]} tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#1f2e28", border: "none", borderRadius: 8 }}
                  labelStyle={{ color: "#e5e7eb" }}
                  formatter={(value) => [`${Math.round(Number(value))}%`, "Average"]}
                />
                <Bar dataKey="average_score" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {roster.filter((r) => r.thisWeekAvg !== null).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-ui text-sm font-semibold text-forest-100">Who needs attention this week</h2>
          <div className="space-y-2">
            {roster
              .filter((r) => r.thisWeekAvg !== null)
              .sort((a, b) => (a.thisWeekAvg ?? 0) - (b.thisWeekAvg ?? 0))
              .slice(0, 5)
              .map((r) => {
                const student = students.find((s) => s.id === r.studentId);
                if (!student) return null;
                return (
                  <button
                    key={r.studentId}
                    onClick={() => navigate(`/shadow-teacher/daily-record?student=${r.studentId}`)}
                    className="w-full flex items-center justify-between bg-forest-900 rounded-lg p-3 hover:bg-forest-800 text-left"
                  >
                    <span className="font-ui text-sm text-forest-100">{student.full_name}</span>
                    <span className="flex items-center gap-2">
                      {r.direction === "improving" && <TrendingUp size={14} className="text-success" />}
                      {r.direction === "declining" && <TrendingDown size={14} className="text-error" />}
                      <span className={`font-ui text-sm font-semibold ${scoreBadgeColor(r.thisWeekAvg!)}`}>
                        {r.thisWeekAvg}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
