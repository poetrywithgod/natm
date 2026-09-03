import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { RequireAuth } from "./guards/RequireAuth";
import { RedirectIfAuthed } from "./guards/RedirectIfAuthed";
import AdminLayout from "./layouts/AdminLayout";
import PageSkeleton from "./components/PageSkeleton";

// Every page is lazy-loaded, same pattern as the staff and student-parent
// apps -- each route's code only downloads when actually visited.
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Schools = lazy(() => import("./pages/Schools"));
const SchoolDetail = lazy(() => import("./pages/SchoolDetail"));
const Staff = lazy(() => import("./pages/Staff"));
const Billing = lazy(() => import("./pages/Billing"));
const Integrations = lazy(() => import("./pages/Integrations"));
const AcademicTerms = lazy(() => import("./pages/AcademicTerms"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Profile = lazy(() => import("./pages/Profile"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Curriculum = lazy(() => import("./pages/Curriculum"));

function AppRoutes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="schools" element={<Schools />} />
          <Route path="schools/:id" element={<SchoolDetail />} />
          <Route path="staff" element={<Staff />} />
          <Route path="billing" element={<Billing />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="academic-terms" element={<AcademicTerms />} />
          <Route path="settings" element={<Settings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="curriculum" element={<Curriculum />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
