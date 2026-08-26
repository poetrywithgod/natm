import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { ToastProvider } from "./features/toast/ToastContext";
import { RequireRole } from "./guards/RequireRole";
import { RedirectIfAuthed } from "./guards/RedirectIfAuthed";
import { StudentOnboardingGate } from "./guards/StudentOnboardingGate";
import StudentLayout from "./layouts/StudentLayout";
import ParentLayout from "./layouts/ParentLayout";
import PageSkeleton from "./components/PageSkeleton";

const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const StudentSetPassword = lazy(() => import("./pages/StudentSetPassword"));
const StudentIntakeForm = lazy(() => import("./pages/StudentIntakeForm"));
const StudentHome = lazy(() => import("./pages/StudentHome"));
const StudentAssignments = lazy(() => import("./pages/StudentAssignments"));
const StudentProgress = lazy(() => import("./pages/StudentProgress"));
const StudentNotifications = lazy(() => import("./pages/StudentNotifications"));
const StudentSettings = lazy(() => import("./pages/StudentSettings"));
const ParentHome = lazy(() => import("./pages/ParentHome"));
const ParentFees = lazy(() => import("./pages/ParentFees"));
const ParentMessages = lazy(() => import("./pages/ParentMessages"));
const ParentChat = lazy(() => import("./pages/ParentChat"));

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
                path="/student/set-password"
                element={
                  <RequireRole allow={["student"]}>
                    <StudentSetPassword />
                  </RequireRole>
                }
              />

              <Route
                path="/student/intake-form"
                element={
                  <RequireRole allow={["student"]}>
                    <StudentIntakeForm />
                  </RequireRole>
                }
              />

              <Route
                path="/student"
                element={
                  <RequireRole allow={["student"]}>
                    <StudentOnboardingGate>
                      <StudentLayout />
                    </StudentOnboardingGate>
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
                path="/parent"
                element={
                  <RequireRole allow={["parent"]}>
                    <ParentLayout />
                  </RequireRole>
                }
              >
                <Route index element={<ParentHome />} />
                <Route path="fees" element={<ParentFees />} />
                <Route path="messages" element={<ParentMessages />} />
                <Route path="messages/:studentId" element={<ParentChat />} />
              </Route>

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
