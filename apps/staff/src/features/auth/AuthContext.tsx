import { createContext, useContext, useState, type ReactNode } from "react";

export type StaffRole = "school_admin" | "class_teacher" | "shadow_teacher";

interface AuthContextValue {
  role: StaffRole;
  setRole: (role: StaffRole) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<StaffRole>("school_admin");
  return <AuthContext.Provider value={{ role, setRole }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
