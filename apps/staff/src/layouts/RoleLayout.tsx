import type { ComponentType } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import HomeschoolLayout from "./HomeschoolLayout";

// A homeschool teacher reaches the admin, class-teacher and shadow-teacher
// pages through their normal paths, but inside her own single layout
// instead of each role's own chrome. Everyone else gets their usual one.
export function withHomeschoolLayout(Standard: ComponentType) {
  return function RoleLayout() {
    const { profile } = useAuth();
    return profile?.role === "homeschool_teacher" ? <HomeschoolLayout /> : <Standard />;
  };
}

// The per-role dashboards (fee charts, "my class" attendance, shadow
// caseload) don't describe a homeschool teacher's day; anything that lands
// on one of them, including every "back to dashboard" link in the shared
// pages, sends her to her own home instead.
export function homeschoolRedirect(Standard: ComponentType) {
  return function RoleHome() {
    const { profile } = useAuth();
    return profile?.role === "homeschool_teacher" ? <Navigate to="/homeschool" replace /> : <Standard />;
  };
}
