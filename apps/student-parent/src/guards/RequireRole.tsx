import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type StudentParentRole } from "../features/auth/AuthContext";

export function RequireRole({ allow, children }: { allow: StudentParentRole[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="p-6 font-ui">Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || !allow.includes(profile.role)) {
    return <div className="p-6 text-error font-ui">Not authorized for this section.</div>;
  }
  return <>{children}</>;
}
