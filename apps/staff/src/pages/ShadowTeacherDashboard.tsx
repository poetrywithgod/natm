import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Megaphone } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchMyStudents,
  fetchSubjectAverages,
  type MyStudent,
  type SubjectAverage,
} from "../features/shadowteacher/api";

export default function ShadowTeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<MyStudent[]>([]);
  const [averages, setAverages] = useState<SubjectAverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    setLoading(true);

    fetchMyStudents(profile.id)
      .then(async (list) => {
        if (cancelled) return;
        setStudents(list);
        const avgData = await fetchSubjectAverages(list.map((s) => s.id));
        if (!cancelled) setAverages(avgData);
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
    </div>
  );
}
