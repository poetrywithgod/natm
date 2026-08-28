import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";

// Landing page for both the "forgot password" link and the parent invite's
// recovery email (see create-parent). Supabase's client auto-detects the
// access token in the URL hash on load and establishes a session before
// this renders -- but that's asynchronous, so this gates on a brief
// "checking" state rather than assuming a session is already there, and
// shows a clear message if the link turns out to be invalid/expired
// instead of a form that will only fail once submitted.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setHasSession(!!session);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setChecking(false);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

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

    setSubmitting(true);
    const { data: userData, error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    // Covers the parent recovery-email path: they land here already
    // authenticated by the emailed link, so this is where "must set my
    // own password" actually gets satisfied. Non-blocking -- if this
    // update fails for some reason, the fallback ParentOnboardingGate
    // still catches it on their next visit to /parent.
    if (userData.user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", userData.user.id);
    }
    setDone(true);
    setSubmitting(false);
    setTimeout(() => navigate("/login"), 1500);
  }

  if (checking) {
    return <div className="min-h-screen bg-abyssal-950" />;
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-abyssal-950 px-4">
        <div className="w-full max-w-sm bg-abyssal-900 p-8 rounded-lg space-y-3 text-center">
          <h1 className="font-display text-xl text-abyssal-100">Link expired or invalid</h1>
          <p className="font-body text-sm text-abyssal-300">
            This password link is no longer valid. Request a new one from the login screen.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full p-2 rounded bg-lime text-abyssal-950 font-ui font-semibold"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-abyssal-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-abyssal-900 p-8 rounded-lg space-y-4">
        <h1 className="font-display text-xl text-abyssal-100">Set a New Password</h1>

        <div className="relative">
          <label htmlFor="reset-password" className="sr-only">New password</label>
          <input
            id="reset-password"
            name="reset-password"
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
          <label htmlFor="reset-confirm-password" className="sr-only">Confirm password</label>
          <input
            id="reset-confirm-password"
            name="reset-confirm-password"
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
        {done && <p className="text-lime text-sm font-ui">Password updated. Redirecting...</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full p-2 rounded bg-lime text-abyssal-950 font-ui font-semibold hover:bg-lime-dark active:scale-95 transition-transform transition-colors duration-150 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save Password"}
        </button>
      </form>
    </div>
  );
}
