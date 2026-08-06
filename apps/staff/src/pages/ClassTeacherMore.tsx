import { Link } from "react-router-dom";
import { ClipboardList, Megaphone, UserCircle, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";

const MORE_ITEMS = [
  { to: "/class-teacher/assign-work", label: "Assign Work", icon: ClipboardList },
  { to: "/class-teacher/announcements", label: "Announcements", icon: Megaphone },
  { to: "/class-teacher/profile", label: "Profile", icon: UserCircle },
];

export default function ClassTeacherMore() {
  const { signOut } = useAuth();

  return (
    <div className="p-4 space-y-2 pb-8">
      <h1 className="font-display text-2xl text-forest-100 mb-2">More</h1>

      {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex items-center justify-between bg-forest-900 rounded-lg p-4 hover:bg-forest-800"
        >
          <div className="flex items-center gap-3">
            <Icon size={20} className="text-forest-400" />
            <span className="font-display text-forest-100">{label}</span>
          </div>
          <ChevronRight size={18} className="text-forest-300" />
        </Link>
      ))}

      <button
        onClick={signOut}
        className="w-full flex items-center gap-3 bg-forest-900 rounded-lg p-4 hover:bg-forest-800 text-error"
      >
        <LogOut size={20} />
        <span className="font-display">Sign out</span>
      </button>
    </div>
  );
}
