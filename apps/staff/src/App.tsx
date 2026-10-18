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
import HomeschoolLayout from "./layouts/HomeschoolLayout";
import { withHomeschoolLayout, homeschoolRedirect } from "./layouts/RoleLayout";
import PageSkeleton from "./components/PageSkeleton";
import MaintenanceBanner from "./components/MaintenanceBanner";

// Every page is lazy-loaded so a heavy dependency in one page (e.g.
// pdfjs-dist in Lessons) never bloats the bundle every other page has to
// download on first load -- each route's code only fetches when visited.
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SchoolAdminDashboard = lazy(() => import("./pages/SchoolAdminDashboard"));
const ClassTeacherAttendance = lazy(() => import("./pages/ClassTeacherAttendance"));
const ClassTeacherDashboard = lazy(() => import("./pages/ClassTeacherDashboard"));
const ClassTeacherMore = lazy(() => import("./pages/ClassTeacherMore"));
const ClassTeacherStudents = lazy(() => import("./pages/ClassTeacherStudents"));
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
const ShadowTeacherMessages = lazy(() => import("./pages/ShadowTeacherMessages"));
const ShadowTeacherChat = lazy(() => import("./pages/ShadowTeacherChat"));
const ClassTeacherMessages = lazy(() => import("./pages/ClassTeacherMessages"));
const ClassTeacherChat = lazy(() => import("./pages/ClassTeacherChat"));
const PtaChat = lazy(() => import("./pages/PtaChat"));
const ShadowTeacherMore = lazy(() => import("./pages/ShadowTeacherMore"));
const ShadowTeacherDailyRecord = lazy(() => import("./pages/ShadowTeacherDailyRecord"));
const FinanceManagerDashboard = lazy(() => import("./pages/FinanceManagerDashboard"));
const FinanceManagerFees = lazy(() => import("./pages/FinanceManagerFees"));
const FinanceManagerAnnouncements = lazy(() => import("./pages/FinanceManagerAnnouncements"));
const FinanceManagerNotifications = lazy(() => import("./pages/FinanceManagerNotifications"));
const FinanceManagerProfile = lazy(() => import("./pages/FinanceManagerProfile"));
const SessionsTerms = lazy(() => import("./pages/SessionsTerms"));
const AdminClasses = lazy(() => import("./pages/AdminClasses"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const AdminParents = lazy(() => import("./pages/AdminParents"));
const AdminParentProfile = lazy(() => import("./pages/AdminParentProfile"));
const AdminStudentProfile = lazy(() => import("./pages/AdminStudentProfile"));
const AdminStaffManagement = lazy(() => import("./pages/AdminStaffManagement"));
const AdminAttendance = lazy(() => import("./pages/AdminAttendance"));
const AdminTimetable = lazy(() => import("./pages/AdminTimetable"));
const AdminPromotion = lazy(() => import("./pages/AdminPromotion"));
const HomeschoolPromotion = lazy(() => import("./pages/HomeschoolPromotion"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const AdminNews = lazy(() => import("./pages/AdminNews"));
const AdminIntake = lazy(() => import("./pages/AdminIntake"));
const AdminIntakeReview = lazy(() => import("./pages/AdminIntakeReview"));
const AdminObservation = lazy(() => import("./pages/AdminObservation"));
const ClassTeacherAnnouncements = lazy(() => import("./pages/ClassTeacherAnnouncements"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const AdminSchoolProfile = lazy(() => import("./pages/AdminSchoolProfile"));
const AdminCurriculum = lazy(() => import("./pages/AdminCurriculum"));
const AdminSubscription = lazy(() => import("./pages/AdminSubscription"));
const ClassTeacherCurriculum = lazy(() => import("./pages/ClassTeacherCurriculum"));
const ShadowTeacherCurriculum = lazy(() => import("./pages/ShadowTeacherCurriculum"));
const HomeschoolDashboard = lazy(() => import("./pages/HomeschoolDashboard"));

// A homeschool teacher uses the admin / class-teacher / shadow-teacher pages
// inside her own layout; everyone else keeps theirs.
const AdminShell = withHomeschoolLayout(AdminLayout);
const ClassTeacherShell = withHomeschoolLayout(ClassTeacherLayout);
const ShadowTeacherShell = withHomeschoolLayout(ShadowTeacherLayout);
const AdminHome = homeschoolRedirect(SchoolAdminDashboard);
const ClassTeacherHome = homeschoolRedirect(ClassTeacherDashboard);
const ShadowTeacherHome = homeschoolRedirect(ShadowTeacherDashboard);

function AppRoutes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/admin"
          element={
            <RequireRole allow={["school_admin", "homeschool_teacher"]}>
              <AdminShell />
            </RequireRole>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="sessions" element={<SessionsTerms />} />
          <Route path="classes" element={<AdminClasses />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="students/:id" element={<AdminStudentProfile />} />
          <Route path="parents" element={<AdminParents />} />
          <Route path="parents/:id" element={<AdminParentProfile />} />
          <Route path="staff" element={<AdminStaffManagement />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="timetable" element={<AdminTimetable />} />
          <Route path="promotion" element={<PromotionPage />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="intake" element={<AdminIntake />} />
          <Route path="intake/:id" element={<AdminIntakeReview />} />
          <Route path="intake/:episodeId/observation" element={<AdminObservation />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
          <Route path="profile" element={<AdminProfile />} />
          <Route path="school-profile" element={<AdminSchoolProfile />} />
          <Route path="curriculum" element={<AdminCurriculum />} />
          <Route path="subscription" element={<AdminSubscription />} />
          <Route path="pta" element={<PtaChat backTo="/admin" desktop />} />
        </Route>

        <Route
          path="/class-teacher"
          element={
            <RequireRole allow={["class_teacher", "homeschool_teacher"]}>
              <ClassTeacherShell />
            </RequireRole>
          }
        >
          <Route index element={<ClassTeacherHome />} />
          <Route path="attendance" element={<ClassTeacherAttendance />} />
          <Route path="students" element={<ClassTeacherStudents />} />
          <Route path="activities" element={<ClassTeacherActivities />} />
          <Route path="lessons" element={<ClassTeacherLessons />} />
          <Route path="assign-work" element={<ClassTeacherAssignWork />} />
          <Route path="curriculum" element={<ClassTeacherCurriculum />} />
          <Route path="notifications" element={<ClassTeacherNotifications />} />
          <Route path="announcements" element={<ClassTeacherAnnouncements />} />
          <Route path="messages" element={<ClassTeacherMessages />} />
          <Route path="messages/:conversationId" element={<ClassTeacherChat />} />
          <Route path="pta" element={<PtaChat backTo="/class-teacher/messages" />} />
          <Route path="profile" element={<ClassTeacherProfile />} />
          <Route path="more" element={<ClassTeacherMore />} />
        </Route>

        <Route
          path="/shadow-teacher"
          element={
            <RequireRole allow={["shadow_teacher", "homeschool_teacher"]}>
              <ShadowTeacherShell />
            </RequireRole>
          }
        >
          <Route index element={<ShadowTeacherHome />} />
          <Route path="students" element={<ShadowTeacherStudents />} />
          <Route path="students/:id" element={<ShadowTeacherStudentDetail />} />
          <Route path="announcements" element={<ShadowTeacherAnnouncements />} />
          <Route path="profile" element={<ShadowTeacherProfile />} />
          <Route path="notifications" element={<ShadowTeacherNotifications />} />
          <Route path="messages" element={<ShadowTeacherMessages />} />
          <Route path="messages/:conversationId" element={<ShadowTeacherChat />} />
          <Route path="pta" element={<PtaChat backTo="/shadow-teacher/messages" />} />
          <Route path="curriculum" element={<ShadowTeacherCurriculum />} />
          <Route path="daily-record" element={<ShadowTeacherDailyRecord />} />
          <Route path="more" element={<ShadowTeacherMore />} />
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
          <Route path="pta" element={<PtaChat backTo="/finance-manager" desktop />} />
          <Route path="profile" element={<FinanceManagerProfile />} />
        </Route>
        <Route
          path="/homeschool"
          element={
            <RequireRole allow={["homeschool_teacher"]}>
              <HomeschoolLayout />
            </RequireRole>
          }
        >
          <Route index element={<HomeschoolDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

// A homeschool teacher gets the suggestion-first promotion flow; school
// admins keep the decide-per-student one unchanged.
function PromotionPage() {
  const { profile } = useAuth();
  return profile?.role === "homeschool_teacher" ? <HomeschoolPromotion /> : <AdminPromotion />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <MaintenanceBanner />
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
