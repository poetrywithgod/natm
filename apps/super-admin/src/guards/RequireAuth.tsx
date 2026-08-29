import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

// AuthContext itself already enforces the super_admin role (see
// loadProfile) -- by the time a session exists here, profile is
// guaranteed to be a super_admin or null. This guard just handles the
// "no session at all" / "still loading" cases for the layout routes.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return null;
  if (!session || !profile) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
