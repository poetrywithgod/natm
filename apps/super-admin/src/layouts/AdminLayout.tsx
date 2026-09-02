import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Building2, ScrollText, ShieldCheck, ChevronLeft, ChevronRight, LogOut, BookOpen, Users, UserCircle, Receipt, Plug, CalendarClock } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/schools", label: "Schools", icon: Building2, end: false },
  { to: "/staff", label: "Staff", icon: Users, end: false },
  { to: "/billing", label: "Billing", icon: Receipt, end: false },
  { to: "/curriculum", label: "Curriculum", icon: BookOpen, end: false },
  { to: "/academic-terms", label: "Academic Terms", icon: CalendarClock, end: false },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText, end: false },
  { to: "/integrations", label: "Integrations", icon: Plug, end: false },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside
        className={`bg-slate-900 border-r border-slate-800 flex flex-col transition-all overflow-y-auto ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex items-center justify-between p-4 sticky top-0 bg-slate-900">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <ShieldCheck className="text-amber-500" size={16} />
              </div>
              <span className="font-display font-bold text-slate-100 text-sm">Super Admin</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-slate-400 hover:text-slate-100"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-1 pt-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg font-ui text-sm transition-colors ${
                  isActive
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100 border border-transparent"
                }`
              }
            >
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg font-ui text-xs mb-1 transition-colors ${
                isActive
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100 border border-transparent"
              }`
            }
          >
            <UserCircle size={16} />
            {!collapsed && <span className="truncate">{profile?.full_name ?? "Profile"}</span>}
          </NavLink>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-ui text-xs text-slate-400 hover:bg-slate-800 hover:text-error transition-colors"
          >
            <LogOut size={16} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
