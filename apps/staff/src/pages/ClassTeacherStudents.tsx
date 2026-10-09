import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchMyClass, fetchClassStudents, type ClassStudent } from "../features/attendance/api";
import GuardianPanel from "../features/students/components/GuardianPanel";
import { getFriendlyErrorMessage } from "@natm/supabase";

export default function ClassTeacherStudents() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const cls = await fetchMyClass(profile.id);
        if (cls) {
          setClassName(cls.name);
          setStudents(await fetchClassStudents(cls.id));
        }
      } catch (e) {
        setError(getFriendlyErrorMessage(e, "Failed to load students"));
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  if (loading) return <div className="p-4 font-ui text-forest-100">Loading...</div>;

  return (
    <div className="p-4 space-y-4 pb-8">
      <h1 className="font-display text-2xl text-forest-100">My Students{className ? ` — ${className}` : ""}</h1>
      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {students.length === 0 && <p className="font-ui text-sm text-forest-300">No students in your class yet.</p>}
      {students.map((s) => (
        <div key={s.id} className="space-y-2">
          <button
            onClick={() => setOpenId(openId === s.id ? null : s.id)}
            className="w-full text-left bg-forest-900 rounded-lg p-4 hover:bg-forest-800"
            aria-expanded={openId === s.id}
          >
            <p className="font-display text-forest-100">{s.full_name}</p>
            <p className="font-ui text-xs text-forest-300">
              ID: {s.unique_student_id} · {openId === s.id ? "Hide parent data" : "Parent data"}
            </p>
          </button>
          {openId === s.id && <GuardianPanel studentId={s.id} />}
        </div>
      ))}
    </div>
  );
}
