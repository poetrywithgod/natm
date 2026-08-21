import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { ToastProvider } from "./features/toast/ToastContext";
import { RequireRole } from "./guards/RequireRole";
import { RedirectIfAuthed } from "./guards/RedirectIfAuthed";
import AdminLayout from "./layouts/AdminLayout";
import ClassTeacherLayout from "./layouts/ClassTeacherLayout";
import ShadowTeacherLayout from "./layouts/ShadowTeacherLayout";
import FinanceManagerLayout from "./layouts/FinanceManagerLayout";
import PageSkeleton from "./components/PageSkeleton";

// Every page is lazy-loaded so a heavy dependency in one page (e.g.
// pdfjs-dist in Lessons) never bloats the bundle every other page has to
// download on first load -- each route's code only fetches when visited.
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SchoolAdminDashboard = lazy(() => import("./pages/SchoolAdminDashboard"));
const ClassTeacherAttendance = lazy(() => import("./pages/ClassTeacherAttendance"));
const ClassTeacherDashboard = lazy(() => import("./pages/ClassTeacherDashboard"));
const ClassTeacherMore = lazy(() => import("./pages/ClassTeacherMore"));
const ClassTeacherProfile = lazy(() => import("./pages/ClassTeacherProfile"));
const ClassTeacherActivities = lazy(() => import("./pages/ClassTeacherActivities"));
const ClassTeacherLessons = lazy(() => import("./pages/ClassTeacherLessons"));
const ClassTeacherAssignWork = lazy(() => import("./pages/ClassTeacherAssignWork"));
const ClassTeacherNotifications = lazy(() => import("./pages/ClassTeacherNotifications"));
const ShadowTeacherDashboard = lazy(() => import("./pages/ShadowTeacherDashboard"));
const ShadowTeacherStudents = lazy(() => import("./pages/ShadowTeacherStudents"));
const ShadowTeacherStudentDetail = lazy(() => import("./pages/ShadowTeacherStudentDetail"));
const ShadowTeacherAnnouncements = lazy(() => import("./pages/ShadowTeacherAnnouncements"));
const ShadowTeacherProfile = lazy(() => import("./pages/ShadowTeacherProfile"));
const ShadowTeacherNotifications = lazy(() => import("./pages/ShadowTeacherNotifications"));
const FinanceManagerDashboard = lazy(() => import("./pages/FinanceManagerDashboard"));
const FinanceManagerFees = lazy(() => import("./pages/FinanceManagerFees"));
const FinanceManagerAnnouncements = lazy(() => import("./pages/FinanceManagerAnnouncements"));
const FinanceManagerNotifications = lazy(() => import("./pages/FinanceManagerNotifications"));
const FinanceManagerProfile = lazy(() => import("./pages/FinanceManagerProfile"));
const SessionsTerms = lazy(() => import("./pages/SessionsTerms"));
const AdminClasses = lazy(() => import("./pages/AdminClasses"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const AdminStudentProfile = lazy(() => import("./pages/AdminStudentProfile"));
const AdminStaffManagement = lazy(() => import("./pages/AdminStaffManagement"));
const AdminAttendance = lazy(() => import("./pages/AdminAttendance"));
const AdminTimetable = lazy(() => import("./pages/AdminTimetable"));
const AdminPromotion = lazy(() => import("./pages/AdminPromotion"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const AdminNews = lazy(() => import("./pages/AdminNews"));
const AdminIntake = lazy(() => import("./pages/AdminIntake"));
const AdminIntakeReview = lazy(() => import("./pages/AdminIntakeReview"));
const AdminObservation = lazy(() => import("./pages/AdminObservation"));
const ClassTeacherAnnouncements = lazy(() => import("./pages/ClassTeacherAnnouncements"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const AdminSchoolProfile = lazy(() => import("./pages/AdminSchoolProfile"));

function SimpleTopBar() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  return (
    <div className="flex justify-between items-center p-4 bg-forest-900 font-ui text-sm text-forest-100">
      <span>{profile.full_name} - {profile.role}</span>
      <button onClick={signOut} className="px-3 py-1 rounded bg-forest-700">
        Sign out
      </button>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
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
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="intake" element={<AdminIntake />} />
          <Route path="intake/:id" element={<AdminIntakeReview />} />
          <Route path="intake/:episodeId/observation" element={<AdminObservation />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="school-profile" element={<AdminSchoolProfile />} />
        </Route>

        <Route
          path="/class-teacher"
          element={
            <RequireRole allow={["class_teacher"]}>
              <ClassTeacherLayout />
            </RequireRole>
          }
        >
          <Route index element={<ClassTeacherDashboard />} />
          <Route path="attendance" element={<ClassTeacherAttendance />} />
          <Route path="activities" element={<ClassTeacherActivities />} />
          <Route path="lessons" element={<ClassTeacherLessons />} />
          <Route path="assign-work" element={<ClassTeacherAssignWork />} />
          <Route path="notifications" element={<ClassTeacherNotifications />} />
          <Route path="announcements" element={<ClassTeacherAnnouncements />} />
          <Route path="profile" element={<ClassTeacherProfile />} />
          <Route path="more" element={<ClassTeacherMore />} />
        </Route>

        <Route
          path="/shadow-teacher"
          element={
            <RequireRole allow={["shadow_teacher"]}>
              <ShadowTeacherLayout />
            </RequireRole>
          }
        >
          <Route index element={<ShadowTeacherDashboard />} />
          <Route path="students" element={<ShadowTeacherStudents />} />
          <Route path="students/:id" element={<ShadowTeacherStudentDetail />} />
          <Route path="announcements" element={<ShadowTeacherAnnouncements />} />
          <Route path="profile" element={<ShadowTeacherProfile />} />
          <Route path="notifications" element={<ShadowTeacherNotifications />} />
        </Route>
        <Route
          path="/finance-manager"
          element={
            <RequireRole allow={["finance_manager"]}>
              <FinanceManagerLayout />
            </RequireRole>
          }
        >
          <Route index element={<FinanceManagerDashboard />} />
          <Route path="fees" element={<FinanceManagerFees />} />
          <Route path="announcements" element={<FinanceManagerAnnouncements />} />
          <Route path="notifications" element={<FinanceManagerNotifications />} />
          <Route path="profile" element={<FinanceManagerProfile />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
