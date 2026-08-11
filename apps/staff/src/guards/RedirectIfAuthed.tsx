import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type StaffRole } from "../features/auth/AuthContext";

const ROLE_HOME: Record<StaffRole, string> = {
  school_admin: "/admin",
  class_teacher: "/class-teacher",
  shadow_teacher: "/shadow-teacher",
  super_admin: "/admin",
  finance_manager: "/finance-manager",
};

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (session && profile) return <Navigate to={ROLE_HOME[profile.role]} replace />;
  return <>{children}</>;
}
