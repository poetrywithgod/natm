import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useFamily, type AppMode } from "../features/family/FamilyContext";

/**
 * Keeps each half of the app on its own side of the Parent / Student toggle.
 * The database enforces the same boundary (session_modes); this just stops the
 * UI from showing screens that would fail.
 */
export function RequireMode({ mode, children }: { mode: AppMode; children: ReactNode }) {
  const { profile } = useAuth();
  const family = useFamily();

  if (!family.ready) return <div className="min-h-screen bg-abyssal-950" />;

  // Legacy student logins have no parent side.
  if (profile?.role === "student") {
    return mode === "student" ? <>{children}</> : <Navigate to="/student" replace />;
  }

  if (family.mode !== mode) {
    return <Navigate to={family.mode === "student" ? "/student" : "/parent"} replace />;
  }
  return <>{children}</>;
}
