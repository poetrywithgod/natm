import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  Contact,
  School,
  ClipboardList,
  FileText,
  Send,
  BookOpen,
  NotebookPen,
  Library,
  MessagesSquare,
  CalendarRange,
  UserCog,
  ArrowUpCircle,
  Megaphone,
  CreditCard,
  Image,
  UserCircle,
  Bell,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchUnreadCount } from "../features/notifications/api";
import { fetchSchoolInfo, type SchoolInfo } from "../features/schools/api";
import { fetchMyClasses, type MyClass } from "../features/attendance/api";
import { pickActiveClass, setActiveClassId } from "../features/classes/activeClass";

// The one layout a homeschool teacher sees. She plays School Admin, Class
// Teacher and Shadow Teacher at once, so this gathers the pages from all
// three roles into one place. The pages themselves are the existing ones,
// reached through their existing paths (/admin/..., /class-teacher/...,
// /shadow-teacher/...); App.tsx swaps this layout in for her on each of
// those route groups, so nothing jumps between differently-styled shells.

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_SECTIONS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ to: "/homeschool", label: "Home", icon: Home, end: true }] },
  {
    title: "Family",
    items: [
      { to: "/admin/students", label: "Children", icon: Users },
      { to: "/admin/parents", label: "Parents & guardians", icon: Contact },
      { to: "/admin/classes", label: "Classes & levels", icon: School },
      { to: "/admin/intake", label: "Intake & assessment", icon: ClipboardList },
    ],
  },
  {
    title: "Teaching",
    items: [
      { to: "/class-teacher/lessons", label: "Lessons", icon: FileText },
      { to: "/class-teacher/assign-work", label: "Assign work", icon: Send },
      { to: "/class-teacher/activities", label: "Daily log", icon: NotebookPen },
      { to: "/shadow-teacher/daily-record", label: "Support record", icon: BookOpen },
      { to: "/admin/curriculum", label: "Curriculum", icon: Library },
      { to: "/class-teacher/messages", label: "Messages", icon: MessagesSquare },
    ],
  },
  {
    title: "Running the school",
    items: [
      { to: "/admin/sessions", label: "Terms", icon: CalendarRange },
      { to: "/admin/staff", label: "Teachers", icon: UserCog },
      { to: "/admin/promotion", label: "Promotion", icon: ArrowUpCircle },
      { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { to: "/admin/subscription", label: "Subscription", icon: CreditCard },
      { to: "/admin/school-profile", label: "Family profile", icon: Image },
    ],
  },
  { title: "Account", items: [{ to: "/admin/profile", label: "My profile", icon: UserCircle }] },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="px-2 pb-4 space-y-4">
      {NAV_SECTIONS.map((section, i) => (
        <div key={section.title ?? i} className="space-y-1">
          {section.title && (
            <p className="px-3 pt-1 font-ui text-[11px] uppercase tracking-wide text-forest-300/70">
              {section.title}
            </p>
          )}
          {section.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded font-ui text-sm ${
                  isActive ? "bg-forest-500 text-forest-950 font-semibold" : "text-forest-100 hover:bg-forest-700"
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export default function HomeschoolLayout() {
  const { profile, session, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [activeClassId, setActive] = useState<string | null>(null);
  // Bumped when she switches class, so the page underneath remounts and
  // reloads its data for the newly selected class.
  const [classVersion, setClassVersion] = useState(0);

  useEffect(() => {
    if (profile?.school_id) fetchSchoolInfo(profile.school_id).then(setSchoolInfo);
  }, [profile?.school_id]);

  // Re-read on navigation: she may have just created a class and made
  // herself its teacher on the Classes page.
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchMyClasses(profile.id)
      .then((rows) => {
        if (cancelled) return;
        setMyClasses(rows);
        setActive(pickActiveClass(rows, profile.id)?.id ?? null);
      })
      .catch((err) => console.error("Failed to load classes:", err));
    return () => {
      cancelled = true;
    };
  }, [profile?.id, location.pathname]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    let cancelled = false;
    const load = () => {
      fetchUnreadCount(userId)
        .then((count) => {
          if (!cancelled) setUnreadCount(count);
        })
        .catch((err) => console.error("Failed to load unread count:", err));
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session?.user?.id]);

  function handleClassChange(classId: string) {
    if (!profile?.id) return;
    setActiveClassId(profile.id, classId);
    setActive(classId);
    setClassVersion((v) => v + 1);
  }

  return (
    <div className="min-h-screen bg-forest-950 md:flex">
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:sticky md:top-0 md:h-screen md:overflow-y-auto bg-forest-900">
        <div className="flex items-center gap-2 p-4 sticky top-0 bg-forest-900">
          <img src="/icons/icon-192.png" alt="" className="w-8 h-8 rounded object-contain" />
          <span className="font-display text-forest-100 text-sm truncate">{schoolInfo?.name ?? "NATM"}</span>
        </div>
        <div className="flex-1">
          <NavList />
        </div>
        <div className="p-4 border-t border-forest-700 sticky bottom-0 bg-forest-900">
          <p className="font-ui text-xs text-forest-300 mb-2 truncate">{profile?.full_name}</p>
          <button onClick={signOut} className="w-full text-xs px-3 py-2 rounded bg-forest-700 text-forest-100 font-ui">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-3 p-3 md:p-4 bg-forest-900 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden p-1.5 rounded bg-forest-700 text-forest-100"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <p className="md:hidden font-display text-forest-100 text-sm truncate">{schoolInfo?.name ?? "NATM"}</p>
            {myClasses.length > 1 && (
              <label className="flex items-center gap-2 font-ui text-xs text-forest-300">
                <span className="hidden sm:inline">Working in</span>
                <select
                  value={activeClassId ?? ""}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="p-1.5 rounded bg-forest-700 text-forest-100 font-ui text-sm"
                  aria-label="Class you are working in"
                >
                  {myClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {myClasses.length === 1 && (
              <span className="font-ui text-xs text-forest-300 truncate">Class: {myClasses[0].name}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/class-teacher/notifications")}
              className="relative p-1.5 rounded bg-forest-700 text-forest-100"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-ui rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={signOut}
              className="md:hidden text-xs px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet key={classVersion} />
        </main>
      </div>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="w-64 max-w-[80%] bg-forest-900 overflow-y-auto">
            <div className="flex items-center justify-between p-4 sticky top-0 bg-forest-900">
              <span className="font-display text-forest-100 text-sm truncate">{schoolInfo?.name ?? "NATM"}</span>
              <button onClick={() => setMenuOpen(false)} className="text-forest-300" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <NavList onNavigate={() => setMenuOpen(false)} />
          </div>
          <button className="flex-1 bg-black/50" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
        </div>
      )}
    </div>
  );
}
