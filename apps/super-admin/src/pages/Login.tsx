import { useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
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
      setError(error.message);
    } else {
      setResetSent(true);
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-14 w-14 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
            <ShieldCheck className="text-amber-500" size={28} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-100">NATM Super Admin</h1>
            <p className="font-body text-sm text-slate-300 mt-1">Platform-wide school management</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
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
                  className="mt-1 w-full p-2 rounded bg-slate-800 text-slate-100 font-body border border-slate-700"
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
                    className="w-full p-2 pr-10 rounded bg-slate-800 text-slate-100 font-body border border-slate-700"
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
                className="w-full p-2 rounded bg-amber-500 text-slate-950 font-ui font-semibold disabled:opacity-60"
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
                  className="mt-1 w-full p-2 rounded bg-slate-800 text-slate-100 font-body border border-slate-700"
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
                className="w-full p-2 rounded bg-amber-500 text-slate-950 font-ui font-semibold disabled:opacity-60"
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
