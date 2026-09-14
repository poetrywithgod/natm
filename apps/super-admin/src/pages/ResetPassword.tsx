import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";

// Landing page for both invite links (create-school's admin_invite,
// create-school-admin) and forgot-password links. Supabase's client
// auto-detects the access token in the URL hash and establishes a
// session before this renders -- but that's asynchronous, so this gates
// on a brief "checking" state and shows a clear message if the link
// turns out to be invalid/expired, same pattern as the other two apps.
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
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
    setTimeout(() => navigate("/login"), 1500);
  }

  if (checking) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen relative flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-amber-500/20 blur-[100px]" />
          <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-slate-700/40 blur-[120px]" />
        </div>
        <div className="relative w-full max-w-sm bg-slate-900/40 backdrop-blur-xl border border-slate-100/10 shadow-2xl shadow-black/40 p-8 rounded-2xl space-y-3 text-center">
          <h1 className="font-display text-xl font-bold text-slate-100">Link expired or invalid</h1>
          <p className="font-body text-sm text-slate-300">
            This password link is no longer valid. Request a new one from the login screen.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full p-2 rounded-lg bg-amber-500 text-slate-950 font-ui font-semibold shadow-lg shadow-amber-500/20"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-amber-500/20 blur-[100px]" />
        <div className="absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-slate-700/40 blur-[110px]" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-amber-600/10 blur-[120px]" />
      </div>
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-slate-900/40 backdrop-blur-xl border border-slate-100/10 shadow-2xl shadow-black/40 p-8 rounded-2xl space-y-4"
      >
        <div className="flex flex-col items-center text-center space-y-2 mb-2">
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 object-contain" />
        </div>
        <h1 className="font-display text-xl font-bold text-slate-100">Set a New Password</h1>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 pr-10 rounded-lg bg-slate-950/40 border border-slate-100/10 text-slate-100 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full p-2 pr-10 rounded-lg bg-slate-950/40 border border-slate-100/10 text-slate-100 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <p className="font-ui text-xs text-error">{error}</p>}
        {done && <p className="font-ui text-xs text-success">Password updated. Redirecting...</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full p-2 rounded-lg bg-amber-500 text-slate-950 font-ui font-semibold shadow-lg shadow-amber-500/20 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save Password"}
        </button>
      </form>
    </div>
  );
}
