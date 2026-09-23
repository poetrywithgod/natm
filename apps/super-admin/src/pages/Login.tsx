import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";

export default function Login() {
  const { signIn, notAuthorized } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "forgot-password">("sign-in");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setSubmitting(false);
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(getFriendlyErrorMessage(error, "Failed to send the password reset email."));
    } else {
      setResetSent(true);
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-amber-500/20 blur-[100px]" />
        <div className="absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-slate-700/40 blur-[110px]" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-amber-600/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <img src="/icons/icon-192.png" alt="" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-100">NATM Super Admin</h1>
            <p className="font-body text-sm text-slate-300 mt-1">Platform-wide school management</p>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-100/10 shadow-2xl shadow-black/40 rounded-2xl p-6 space-y-4">
          {notAuthorized && (
            <p className="font-ui text-xs text-error bg-error/10 border border-error/30 rounded p-2">
              That account isn't authorized for Super Admin access.
            </p>
          )}

          {mode === "sign-in" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="font-ui text-xs text-slate-300">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full p-2 rounded-lg bg-slate-950/40 text-slate-100 font-body border border-slate-100/10 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                  required
                />
              </div>
              <div>
                <label htmlFor="login-password" className="font-ui text-xs text-slate-300">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 pr-10 rounded-lg bg-slate-950/40 text-slate-100 font-body border border-slate-100/10 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && <p className="font-ui text-xs text-error">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full p-2 rounded-lg bg-amber-500 text-slate-950 font-ui font-semibold shadow-lg shadow-amber-500/20 disabled:opacity-60"
              >
                {submitting ? "Signing in..." : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("forgot-password");
                  setError(null);
                }}
                className="w-full text-center font-ui text-xs text-slate-300 underline"
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="font-body text-sm text-slate-300">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div>
                <label htmlFor="reset-email" className="font-ui text-xs text-slate-300">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full p-2 rounded-lg bg-slate-950/40 text-slate-100 font-body border border-slate-100/10 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                  required
                />
              </div>
              {error && <p className="font-ui text-xs text-error">{error}</p>}
              {resetSent && (
                <p className="font-ui text-xs text-success">
                  If that email is registered, a reset link is on its way.
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full p-2 rounded-lg bg-amber-500 text-slate-950 font-ui font-semibold shadow-lg shadow-amber-500/20 disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("sign-in");
                  setError(null);
                  setResetSent(false);
                }}
                className="w-full text-center font-ui text-xs text-slate-300 underline"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
