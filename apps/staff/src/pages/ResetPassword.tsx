import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../features/auth/AuthContext";

// Landing page for both the "invite a new staff member" and "forgot password"
// email links. Supabase's client auto-detects the access token in the URL
// hash and establishes a session before this component even renders — all
// this page has to do is collect a new password and call updateUser.
export default function ResetPassword() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function redirectByRole() {
    if (!profile) {
      navigate("/login", { replace: true });
      return;
    }
    if (profile.role === "school_admin") navigate("/admin", { replace: true });
    else if (profile.role === "class_teacher") navigate("/class-teacher", { replace: true });
    else if (profile.role === "shadow_teacher") navigate("/shadow-teacher", { replace: true });
    else navigate("/login", { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    redirectByRole();
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center font-ui text-forest-100">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-forest-950 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-forest-900 rounded-lg p-6 space-y-4"
      >
        <div>
          <h1 className="font-display text-xl text-forest-100">Set your password</h1>
          <p className="font-ui text-xs text-forest-300 mt-1">
            Choose a password to finish setting up your account.
          </p>
        </div>

        {error && <p className="text-error font-ui text-sm">{error}</p>}

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 pr-10 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
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
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 pr-10 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
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
          className="w-full px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Password"}
        </button>
      </form>
    </div>
  );
}
