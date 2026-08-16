import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, BookOpen, TrendingUp, Bell, Settings } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchUnreadCount } from "../features/notifications/api";
import { fetchSchoolInfo, type SchoolInfo } from "../features/schools/api";
import { fetchOwnStudentRecord, getSignedStudentPhotoUrl } from "../features/profile/api";

const NAV_ITEMS = [
  { to: "/student", label: "Home", icon: Home, end: true },
  { to: "/student/assignments", label: "Assignments", icon: BookOpen, end: false },
  { to: "/student/progress", label: "Progress", icon: TrendingUp, end: false },
  { to: "/student/notifications", label: "Alerts", icon: Bell, end: false },
  { to: "/student/settings", label: "Settings", icon: Settings, end: false },
];

export default function StudentLayout() {
  const { profile, session, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchoolInfo(profile.school_id).then(setSchoolInfo);
    }
  }, [profile?.school_id]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchOwnStudentRecord(profile.id).then((record) => {
      if (cancelled || !record?.photo_url) return;
      getSignedStudentPhotoUrl(record.photo_url).then((url) => {
        if (!cancelled) setPhotoUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

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

  return (
    <div className="min-h-screen flex flex-col bg-abyssal-950">
      <header className="flex items-center justify-between p-4 bg-abyssal-900 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-abyssal-700 overflow-hidden flex items-center justify-center shrink-0">
            {schoolInfo?.logo_url ? (
              <img src={schoolInfo.logo_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="font-display text-abyssal-100 text-[10px]">N</span>
            )}
          </div>
          <div>
            <p className="font-display text-abyssal-100 text-sm">{schoolInfo?.name ?? "NATM"}</p>
            <div className="flex items-center gap-1.5">
              {photoUrl && (
                <img src={photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
              )}
              <p className="font-ui text-xs text-abyssal-300">{profile?.full_name}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/student/notifications")}
            className="relative p-1.5 rounded bg-abyssal-700 text-abyssal-100"
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
            className="text-xs px-3 py-1.5 rounded bg-abyssal-700 text-abyssal-100 font-ui"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-abyssal-900 border-t border-abyssal-700 flex">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 font-ui text-xs ${
                isActive ? "text-lime" : "text-abyssal-300"
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
