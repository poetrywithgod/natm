import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type StudentParentRole } from "../features/auth/AuthContext";

const ROLE_HOME: Record<StudentParentRole, string> = {
  student: "/student",
  parent: "/parent",
};

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (session && profile) return <Navigate to={ROLE_HOME[profile.role]} replace />;
  return <>{children}</>;
}
