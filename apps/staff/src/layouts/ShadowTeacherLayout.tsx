import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageCircle, MoreHorizontal, Bell } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchUnreadCount } from "../features/notifications/api";
import { fetchConversationsForShadowTeacher } from "../features/messaging/api";
import { fetchSchoolInfo, type SchoolInfo } from "../features/schools/api";
import { getSignedPhotoUrl } from "../features/profile/api";

const NAV_ITEMS = [
  { to: "/shadow-teacher", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/shadow-teacher/students", label: "Students", icon: Users, end: false },
  { to: "/shadow-teacher/messages", label: "Messages", icon: MessageCircle, end: false },
  { to: "/shadow-teacher/more", label: "More", icon: MoreHorizontal, end: false },
];

export default function ShadowTeacherLayout() {
  const { profile, session, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchoolInfo(profile.school_id).then(setSchoolInfo);
    }
  }, [profile?.school_id]);

  useEffect(() => {
    let cancelled = false;
    const photoPath = profile?.photo_url;
    const load = photoPath ? getSignedPhotoUrl(photoPath) : Promise.resolve(null);
    load.then((url) => {
      if (!cancelled) setPhotoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.photo_url]);

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

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    const load = () => {
      fetchConversationsForShadowTeacher(profile.id)
        .then((rows) => {
          if (!cancelled) setUnreadMessages(rows.reduce((sum, r) => sum + r.unread_count, 0));
        })
        .catch((err) => console.error("Failed to load message unread count:", err));
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile?.id]);

  return (
    <div className="min-h-screen flex flex-col bg-forest-950">
      <header className="flex items-center justify-between p-4 bg-forest-900 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-forest-800 overflow-hidden flex items-center justify-center shrink-0">
            {schoolInfo?.logo_url ? (
              <img src={schoolInfo.logo_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <img src="/icons/icon-192.png" alt="" className="w-full h-full object-contain" />
            )}
          </div>
          <div>
            <p className="font-display text-forest-100 text-sm">{schoolInfo?.name ?? "NATM"}</p>
            <div className="flex items-center gap-1.5">
              {photoUrl && (
                <img src={photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
              )}
              <p className="font-ui text-xs text-forest-300">{profile?.full_name}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/shadow-teacher/notifications")}
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
            className="text-xs px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui"
          >
            Sign out
          </button>
        </div>
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
            <span className="relative">
              <Icon size={20} />
              {to === "/shadow-teacher/messages" && unreadMessages > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-ui rounded-full min-w-3.5 h-3.5 px-1 flex items-center justify-center">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
