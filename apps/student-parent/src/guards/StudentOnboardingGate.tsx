import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { fetchOwnStudentRecord, type OnboardingStatus } from "../features/profile/api";

export function StudentOnboardingGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchOwnStudentRecord(profile.id).then((rec) => {
      if (cancelled) return;
      setStatus(rec?.onboarding_status ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (loading) return <div className="min-h-screen bg-abyssal-950" />;

  if (status === "pending_password_reset") {
    return <Navigate to="/student/set-password" replace />;
  }

  if (status === "pending_intake_form") {
    return <Navigate to="/student/intake-form" replace />;
  }

  // pending_review (awaiting admin) gating lands in a later pass, once
  // there's a holding screen for it.
  return <>{children}</>;
}
