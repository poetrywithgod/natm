import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { RequireRole } from "./guards/RequireRole";
import { RedirectIfAuthed } from "./guards/RedirectIfAuthed";
import AdminLayout from "./layouts/AdminLayout";
import ClassTeacherLayout from "./layouts/ClassTeacherLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import SchoolAdminDashboard from "./pages/SchoolAdminDashboard";
import ClassTeacherAttendance from "./pages/ClassTeacherAttendance";
import ClassTeacherProfile from "./pages/ClassTeacherProfile";
import ShadowTeacherDashboard from "./pages/ShadowTeacherDashboard";
import SessionsTerms from "./pages/SessionsTerms";
import AdminClasses from "./pages/AdminClasses";
import AdminStudents from "./pages/AdminStudents";
import AdminStudentProfile from "./pages/AdminStudentProfile";
import AdminStaffManagement from "./pages/AdminStaffManagement";
import AdminAttendance from "./pages/AdminAttendance";
import AdminTimetable from "./pages/AdminTimetable";
import AdminPromotion from "./pages/AdminPromotion";
import AdminFees from "./pages/AdminFees";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import ClassTeacherAnnouncements from "./pages/ClassTeacherAnnouncements";
import AdminAuditLog from "./pages/AdminAuditLog";
import AdminProfile from "./pages/AdminProfile";

function SimpleTopBar() {
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
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/admin"
        element={
          <RequireRole allow={["school_admin"]}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<SchoolAdminDashboard />} />
        <Route path="sessions" element={<SessionsTerms />} />
        <Route path="classes" element={<AdminClasses />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="students/:id" element={<AdminStudentProfile />} />
        <Route path="staff" element={<AdminStaffManagement />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="timetable" element={<AdminTimetable />} />
        <Route path="promotion" element={<AdminPromotion />} />
        <Route path="fees" element={<AdminFees />} />
        <Route path="announcements" element={<AdminAnnouncements />} />
        <Route path="audit-log" element={<AdminAuditLog />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      <Route
        path="/class-teacher"
        element={
          <RequireRole allow={["class_teacher"]}>
            <ClassTeacherLayout />
          </RequireRole>
        }
      >
        <Route index element={<ClassTeacherAttendance />} />
        <Route path="announcements" element={<ClassTeacherAnnouncements />} />
        <Route path="profile" element={<ClassTeacherProfile />} />
      </Route>

      <Route
        path="/shadow-teacher"
        element={
          <RequireRole allow={["shadow_teacher"]}>
            <>
              <SimpleTopBar />
              <ShadowTeacherDashboard />
            </>
          </RequireRole>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
