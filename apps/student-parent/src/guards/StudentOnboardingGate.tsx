import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useFamily } from "../features/family/FamilyContext";
import { advanceOnboardingStatus, fetchOwnStudentRecord, type OnboardingStatus } from "../features/profile/api";

export function StudentOnboardingGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { activeStudentId } = useFamily();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const isFamily = profile?.role === "parent";
  const mustChangePassword = isFamily && !!profile?.must_change_password;

  useEffect(() => {
    if (!profile?.id || mustChangePassword) return;
    let cancelled = false;
    fetchOwnStudentRecord(profile.id, activeStudentId).then(async (rec) => {
      if (cancelled) return;
      let current = rec?.onboarding_status ?? null;

      // A family account sets its password once, on the parent side. The
      // child-level "set password" step is already satisfied, so move the
      // child on to the intake form instead of asking again.
      if (isFamily && rec && current === "pending_password_reset") {
        try {
          await advanceOnboardingStatus(rec.id, "pending_intake_form");
          current = "pending_intake_form";
        } catch (err) {
          console.error("Failed to advance onboarding status:", err);
        }
      }

      if (cancelled) return;
      setStatus(current);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, activeStudentId, isFamily, mustChangePassword]);

  // Family accounts that still hold a temporary password must reset it first.
  if (mustChangePassword) return <Navigate to="/parent/set-password" replace />;

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
