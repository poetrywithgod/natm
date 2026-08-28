import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Wallet, Megaphone, Bell, UserCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchSchoolInfo, type SchoolInfo } from "../features/schools/api";

function navItems(feesLabel: string) {
  return [
    { to: "/finance-manager", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/finance-manager/fees", label: feesLabel, icon: Wallet, end: false },
    { to: "/finance-manager/announcements", label: "Announcements", icon: Megaphone, end: false },
    { to: "/finance-manager/notifications", label: "Notifications", icon: Bell, end: false },
    { to: "/finance-manager/profile", label: "Profile", icon: UserCircle, end: false },
  ];
}

export default function FinanceManagerLayout() {
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchoolInfo(profile.school_id).then(setSchoolInfo);
    }
  }, [profile?.school_id]);

  const NAV_ITEMS = navItems(schoolInfo?.financial_model === "partnership" ? "Support" : "Fees");

  return (
    <div className="flex min-h-screen bg-forest-950">
      <aside
        className={`bg-forest-900 flex flex-col transition-all overflow-y-auto ${collapsed ? "w-16" : "w-56"}`}
      >
        <div className="flex items-center justify-between p-4 sticky top-0 bg-forest-900">
          {!collapsed && <span className="font-display text-forest-100 text-sm">NATM Finance</span>}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-forest-300 hover:text-forest-100"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-1 pb-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded font-ui text-sm ${
                  isActive
                    ? "bg-forest-500 text-forest-950 font-semibold"
                    : "text-forest-100 hover:bg-forest-700"
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-forest-700 sticky bottom-0 bg-forest-900">
          {!collapsed && (
            <p className="font-ui text-xs text-forest-300 mb-2 truncate">
              {profile?.full_name} — Finance Manager
            </p>
          )}
          <button
            onClick={signOut}
            className="w-full text-xs px-3 py-2 rounded bg-forest-700 text-forest-100 font-ui"
          >
            {collapsed ? "Out" : "Sign out"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
