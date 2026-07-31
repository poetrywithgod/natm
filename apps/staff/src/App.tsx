import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, type StaffRole } from "./features/auth/AuthContext";
import { RequireRole } from "./guards/RequireRole";
import SchoolAdminDashboard from "./pages/SchoolAdminDashboard";
import ClassTeacherDashboard from "./pages/ClassTeacherDashboard";
import ShadowTeacherDashboard from "./pages/ShadowTeacherDashboard";

function RoleSwitcher() {
  const { role, setRole } = useAuth();
  const roles: StaffRole[] = ["school_admin", "class_teacher", "shadow_teacher"];
  return (
    <div className="flex gap-2 p-4 bg-forest-900 font-ui text-sm">
      <span className="opacity-70">Dev role switcher:</span>
      {roles.map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          className={`px-2 py-1 rounded ${role === r ? "bg-forest-500" : "bg-forest-700"}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<RequireRole allow={["school_admin"]}><SchoolAdminDashboard /></RequireRole>} />
      <Route path="/class-teacher" element={<RequireRole allow={["class_teacher"]}><ClassTeacherDashboard /></RequireRole>} />
      <Route path="/shadow-teacher" element={<RequireRole allow={["shadow_teacher"]}><ShadowTeacherDashboard /></RequireRole>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RoleSwitcher />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
