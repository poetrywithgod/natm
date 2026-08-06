import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ClipboardCheck, BookOpen, FileText, MoreHorizontal } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";

const NAV_ITEMS = [
  { to: "/class-teacher", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/class-teacher/attendance", label: "Attendance", icon: ClipboardCheck, end: false },
  { to: "/class-teacher/activities", label: "Activities", icon: BookOpen, end: false },
  { to: "/class-teacher/lessons", label: "Lessons", icon: FileText, end: false },
  { to: "/class-teacher/more", label: "More", icon: MoreHorizontal, end: false },
];

export default function ClassTeacherLayout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-forest-950">
      <header className="flex items-center justify-between p-4 bg-forest-900 sticky top-0 z-10">
        <div>
          <p className="font-display text-forest-100 text-sm">NATM</p>
          <p className="font-ui text-xs text-forest-300">{profile?.full_name}</p>
        </div>
        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 overflow-auto pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-forest-900 border-t border-forest-700 flex">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 font-ui text-xs ${
                isActive ? "text-forest-100" : "text-forest-300"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
