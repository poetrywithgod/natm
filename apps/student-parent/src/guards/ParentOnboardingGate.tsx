import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export function ParentOnboardingGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();

  if (profile?.must_change_password) {
    return <Navigate to="/parent/set-password" replace />;
  }

  return <>{children}</>;
}
