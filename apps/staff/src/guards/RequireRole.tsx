import type { ReactNode } from "react";
import { useAuth, type StaffRole } from "../features/auth/AuthContext";

export function RequireRole({ allow, children }: { allow: StaffRole[]; children: ReactNode }) {
  const { role } = useAuth();
  if (!allow.includes(role)) {
    return <div className="p-6 text-error font-ui">Not authorized for this section.</div>;
  }
  return <>{children}</>;
}
