import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, NotebookPen, FileText, Send, MessagesSquare, Library } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchDashboardSummary, type DashboardSummary } from "../features/dashboard/api";
import { fetchStudents, type Student } from "../features/students/api";
import { fetchClasses, type SchoolClass } from "../features/classes/api";
import { fetchMyClasses, type MyClass } from "../features/attendance/api";
import { getFriendlyErrorMessage } from "@natm/supabase";

const QUICK_ACTIONS = [
  { to: "/class-teacher/activities", label: "Daily log", hint: "Record today's session and attendance", icon: NotebookPen },
  { to: "/class-teacher/lessons", label: "Lessons", hint: "Plan and upload lessons", icon: FileText },
  { to: "/class-teacher/assign-work", label: "Assign work", hint: "Set work and quizzes", icon: Send },
  { to: "/admin/curriculum", label: "Curriculum", hint: "Browse by level and term", icon: Library },
  { to: "/shadow-teacher/messages", label: "Messages", hint: "Talk to parents", icon: MessagesSquare },
];

export default function HomeschoolDashboard() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.school_id) return;
    let cancelled = false;
    Promise.all([
      fetchDashboardSummary(profile.school_id),
      fetchStudents(profile.school_id),
      fetchClasses(profile.school_id),
      fetchMyClasses(profile.id),
    ])
      .then(([s, st, cl, mine]) => {
        if (cancelled) return;
        setSummary(s);
        setStudents(st);
        setClasses(cl);
        setMyClasses(mine);
      })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyErrorMessage(e, "Failed to load your home page"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.school_id, profile?.id]);

  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? null;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const steps = [
    {
      done: !!summary?.currentSessionName && summary.currentTermNumber !== null,
      label: "Set up the school year and current term",
      to: "/admin/sessions",
    },
    {
      done: (summary?.classCount ?? 0) > 0,
      label: "Create a class for each level your children are at",
      to: "/admin/classes",
    },
    {
      done: myClasses.length > 0,
      label: "Make yourself the class teacher of those classes",
      to: "/admin/classes",
    },
    {
      done: (summary?.studentCount ?? 0) > 0,
      label: "Add your children",
      to: "/admin/students",
    },
  ];
  const setupComplete = steps.every((s) => s.done);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Welcome{firstName ? `, ${firstName}` : ""}</h1>
        {summary?.currentSessionName && (
          <p className="font-ui text-sm text-forest-300 mt-1">
            {summary.currentSessionName}
            {summary.currentTermNumber ? ` · Term ${summary.currentTermNumber}` : ""}
          </p>
        )}
      </div>

      {error && <p className="font-ui text-sm text-error">{error}</p>}
      {loading && <p className="font-ui text-sm text-forest-300">Loading...</p>}

      {!loading && !setupComplete && (
        <section className="bg-forest-900 rounded-xl p-4 space-y-3">
          <h2 className="font-display text-forest-100">Getting started</h2>
          <ul className="space-y-2">
            {steps.map((step) => (
              <li key={step.label}>
                <Link to={step.to} className="flex items-center gap-3 font-ui text-sm">
                  {step.done ? (
                    <CheckCircle2 size={18} className="text-forest-500 shrink-0" />
                  ) : (
                    <Circle size={18} className="text-forest-300 shrink-0" />
                  )}
                  <span className={step.done ? "text-forest-300 line-through" : "text-forest-100"}>{step.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-forest-100">Today</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_ACTIONS.map(({ to, label, hint, icon: Icon }) => (
            <Link key={to} to={to} className="bg-forest-900 hover:bg-forest-800 rounded-xl p-4 space-y-2 block">
              <Icon size={20} className="text-forest-500" />
              <p className="font-ui text-sm text-forest-100 font-semibold">{label}</p>
              <p className="font-ui text-xs text-forest-300">{hint}</p>
            </Link>
          ))}
        </div>
      </section>

      {!loading && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-forest-100">Your children</h2>
            <Link to="/admin/students" className="font-ui text-xs text-forest-300 underline">
              Manage
            </Link>
          </div>
          {students.length === 0 ? (
            <p className="font-ui text-sm text-forest-300">No children added yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {students.map((s) => (
                <Link
                  key={s.id}
                  to={`/admin/students/${s.id}`}
                  className="bg-forest-900 hover:bg-forest-800 rounded-xl p-4 block"
                >
                  <p className="font-ui text-sm text-forest-100 font-semibold">{s.full_name}</p>
                  <p className="font-ui text-xs text-forest-300 mt-1">
                    {className(s.class_id) ?? "Awaiting assessment — no class yet"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
