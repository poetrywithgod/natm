import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchOwnStudentRecord, advanceOnboardingStatus } from "../features/profile/api";

export default function StudentSetPassword() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchOwnStudentRecord(profile.id).then((rec) => {
      if (cancelled) return;
      if (rec && rec.onboarding_status !== "pending_password_reset") {
        navigate("/student", { replace: true });
        return;
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!profile?.id) return;

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }
      const rec = await fetchOwnStudentRecord(profile.id);
      if (rec) {
        await advanceOnboardingStatus(rec.id, "pending_intake_form");
      }
      navigate("/student", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set password");
      setSubmitting(false);
    }
  }

  if (checking) {
    return <div className="min-h-screen bg-abyssal-950" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-abyssal-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-abyssal-900 p-8 rounded-lg space-y-4">
        <div>
          <h1 className="font-display text-xl text-abyssal-100">Set Your Password</h1>
          <p className="font-body text-sm text-abyssal-300 mt-1">
            Welcome! Choose a new password to secure your account.
          </p>
        </div>
        <div className="relative">
          <label htmlFor="student-new-password" className="sr-only">New password</label>
          <input
            id="student-new-password"
            name="student-new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 pr-10 rounded bg-abyssal-700 text-abyssal-100 font-ui placeholder:text-abyssal-300/60"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-abyssal-300"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="relative">
          <label htmlFor="student-confirm-password" className="sr-only">Confirm password</label>
          <input
            id="student-confirm-password"
            name="student-confirm-password"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full p-2 pr-10 rounded bg-abyssal-700 text-abyssal-100 font-ui placeholder:text-abyssal-300/60"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-abyssal-300"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && <p className="text-error text-sm font-ui">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full p-2 rounded bg-lime text-abyssal-950 font-ui font-semibold hover:bg-lime-dark active:scale-95 transition-transform transition-colors duration-150 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
