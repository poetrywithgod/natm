import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type StudentParentRole } from "../features/auth/AuthContext";
import { useFamily } from "../features/family/FamilyContext";

const ROLE_HOME: Record<StudentParentRole, string> = {
  student: "/student",
  parent: "/parent",
};

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const family = useFamily();

  if (loading || !family.ready) return null;
  if (session && profile) {
    // A family login that is currently in Student view goes back to it.
    const home = profile.role === "parent" && family.mode === "student" ? "/student" : ROLE_HOME[profile.role];
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}
