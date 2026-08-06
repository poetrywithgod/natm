import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, ClipboardCheck, BookOpen, FileText } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchMyClass, fetchClassStudents, fetchAttendanceForDate, type MyClass } from "../features/attendance/api";
import { fetchClassActivities } from "../features/activities/api";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClassTeacherDashboard() {
  const { profile } = useAuth();
  const [myClass, setMyClass] = useState<MyClass | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [recentActivityCount, setRecentActivityCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const cls = await fetchMyClass(profile.id);
      setMyClass(cls);
      if (cls) {
        const [students, attendance, activities] = await Promise.all([
          fetchClassStudents(cls.id),
          fetchAttendanceForDate(cls.id, todayISO()),
          fetchClassActivities(cls.id, 5),
        ]);
        setStudentCount(students.length);
        setAttendanceMarked(attendance.length > 0);
        setRecentActivityCount(activities.length);
      }
      setLoading(false);
    }
    load();
  }, [profile?.id]);

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  if (!myClass) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl text-forest-100">Dashboard</h1>
        <p className="font-ui text-sm text-forest-300 mt-2">
          You're not currently assigned to a class. Contact your School Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Welcome back{profile ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="font-ui text-xs text-forest-300">{myClass.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-forest-900 rounded-lg p-4">
          <Users size={18} className="text-forest-400 mb-1" />
          <p className="font-display text-xl text-forest-100">{studentCount}</p>
          <p className="font-ui text-xs text-forest-300">Students</p>
        </div>
        <div className="bg-forest-900 rounded-lg p-4">
          <ClipboardCheck size={18} className="text-forest-400 mb-1" />
          <p className="font-display text-xl text-forest-100">{attendanceMarked ? "Marked" : "Pending"}</p>
          <p className="font-ui text-xs text-forest-300">Today's Attendance</p>
        </div>
      </div>

      <div className="space-y-2">
        <Link
          to="/class-teacher/attendance"
          className="flex items-center gap-3 bg-forest-900 rounded-lg p-4 hover:bg-forest-800"
        >
          <ClipboardCheck size={20} className="text-forest-400" />
          <div>
            <p className="font-display text-forest-100">Attendance</p>
            <p className="font-ui text-xs text-forest-300">
              {attendanceMarked ? "Marked for today" : "Not yet marked today"}
            </p>
          </div>
        </Link>

        <Link
          to="/class-teacher/activities"
          className="flex items-center gap-3 bg-forest-900 rounded-lg p-4 hover:bg-forest-800"
        >
          <BookOpen size={20} className="text-forest-400" />
          <div>
            <p className="font-display text-forest-100">Daily Activities</p>
            <p className="font-ui text-xs text-forest-300">{recentActivityCount} logged recently</p>
          </div>
        </Link>

        <Link
          to="/class-teacher/lessons"
          className="flex items-center gap-3 bg-forest-900 rounded-lg p-4 hover:bg-forest-800"
        >
          <FileText size={20} className="text-forest-400" />
          <div>
            <p className="font-display text-forest-100">Lessons & Quizzes</p>
            <p className="font-ui text-xs text-forest-300">Upload lessons, generate quizzes</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
