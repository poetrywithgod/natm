import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { ToastProvider } from "./features/toast/ToastContext";
import { RequireRole } from "./guards/RequireRole";
import { RedirectIfAuthed } from "./guards/RedirectIfAuthed";
import StudentLayout from "./layouts/StudentLayout";
import PageSkeleton from "./components/PageSkeleton";

const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const StudentHome = lazy(() => import("./pages/StudentHome"));
const StudentAssignments = lazy(() => import("./pages/StudentAssignments"));
const StudentProgress = lazy(() => import("./pages/StudentProgress"));
const StudentNotifications = lazy(() => import("./pages/StudentNotifications"));
const StudentSettings = lazy(() => import("./pages/StudentSettings"));
const ParentComingSoon = lazy(() => import("./pages/ParentComingSoon"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
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
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route
                path="/student"
                element={
                  <RequireRole allow={["student"]}>
                    <StudentLayout />
                  </RequireRole>
                }
              >
                <Route index element={<StudentHome />} />
                <Route path="assignments" element={<StudentAssignments />} />
                <Route path="progress" element={<StudentProgress />} />
                <Route path="notifications" element={<StudentNotifications />} />
                <Route path="settings" element={<StudentSettings />} />
              </Route>

              <Route
                path="/parent/*"
                element={
                  <RequireRole allow={["parent"]}>
                    <ParentComingSoon />
                  </RequireRole>
                }
              />

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
