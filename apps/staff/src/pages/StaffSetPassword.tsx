import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { passwordProblem } from "@natm/shared-types";
import { getFriendlyErrorMessage } from "@natm/supabase";
import PasswordChecklist from "../components/PasswordChecklist";
import { supabase } from "../lib/supabase";
import { useAuth } from "../features/auth/AuthContext";
import { ROLE_HOME } from "../guards/RedirectIfAuthed";

// First-sign-in screen for staff whose account was created by an admin with
// a temporary password. RequireRole sends anyone with
// profiles.must_change_password here and lets them nowhere else.
//
// The flag is NOT cleared from the client (the DB forbids that). A trigger on
// auth.users clears it only when the password actually changes, so all this
// page does is call updateUser and then reload the profile.
export default function StaffSetPassword() {
  const navigate = useNavigate();
  const { session, profile, loading, refreshProfile, signOut } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the flag is cleared and the profile reloaded, send them home.
  useEffect(() => {
    if (profile && !profile.must_change_password) {
      navigate(ROLE_HOME[profile.role], { replace: true });
    }
  }, [profile, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const passwordIssue = passwordProblem(password);
    if (passwordIssue) {
      setError(passwordIssue);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      setError(getFriendlyErrorMessage(updateError, "Failed to update your password."));
      return;
    }

    await refreshProfile();
    setSubmitting(false);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-ui text-forest-100">Loading...</div>;
  }
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-forest-950 p-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-forest-500/30 blur-[100px]" />
        <div className="absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-forest-300/20 blur-[110px]" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-forest-700/40 blur-[120px]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-forest-900/40 backdrop-blur-xl border border-forest-100/10 shadow-2xl shadow-black/40 rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col items-center text-center space-y-2 mb-2">
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 object-contain" />
        </div>
        <div>
          <h1 className="font-display text-xl text-forest-100">
            Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="font-ui text-xs text-forest-300 mt-1">
            You signed in with a temporary password. Choose a new one that only you know to continue.
          </p>
        </div>

        {error && <p className="text-error font-ui text-sm">{error}</p>}

        <div className="relative">
          <label htmlFor="new-staff-password" className="sr-only">New password</label>
          <input
            id="new-staff-password"
            name="new-staff-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 pr-10 rounded-lg bg-forest-950/40 border border-forest-100/10 text-forest-100 font-ui placeholder:text-forest-300/60 focus:outline-none focus:ring-2 focus:ring-forest-500/60"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-forest-300"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <PasswordChecklist password={password} />
        <div className="relative">
          <label htmlFor="confirm-staff-password" className="sr-only">Confirm password</label>
          <input
            id="confirm-staff-password"
            name="confirm-staff-password"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 pr-10 rounded-lg bg-forest-950/40 border border-forest-100/10 text-forest-100 font-ui placeholder:text-forest-300/60 focus:outline-none focus:ring-2 focus:ring-forest-500/60"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-forest-300"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 rounded-lg bg-forest-500 text-forest-950 font-ui font-semibold shadow-lg shadow-forest-500/20 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Password & Continue"}
        </button>
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full font-ui text-xs text-forest-300 hover:text-forest-100"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
