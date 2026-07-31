import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { RequireRole } from "./guards/RequireRole";
import { RedirectIfAuthed } from "./guards/RedirectIfAuthed";
import Login from "./pages/Login";
import SchoolAdminDashboard from "./pages/SchoolAdminDashboard";
import ClassTeacherDashboard from "./pages/ClassTeacherDashboard";
import ShadowTeacherDashboard from "./pages/ShadowTeacherDashboard";

function TopBar() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  return (
    <div className="flex justify-between items-center p-4 bg-forest-900 font-ui text-sm text-forest-100">
      <span>{profile.full_name} — {profile.role}</span>
      <button onClick={signOut} className="px-3 py-1 rounded bg-forest-700">
        Sign out
      </button>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
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
        <TopBar />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
