import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";

export default function Login() {
  const { signIn } = useAuth();
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
    <div className="min-h-screen flex items-center justify-center bg-forest-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src="/logo.svg"
            alt="School logo"
            className="h-16 w-16 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div>
            <h1 className="font-display text-2xl text-forest-100">NATM Staff Portal</h1>
            <p className="font-body text-sm text-forest-300 mt-1">
              Every student's progress starts with the work you do today. Welcome back.
            </p>
          </div>
        </div>

        {mode === "sign-in" ? (
          <form onSubmit={handleSignIn} className="bg-forest-900 p-8 rounded-lg space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
              required
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
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
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setMode("forgot-password");
                  setError(null);
                  setResetSent(false);
                }}
                className="text-xs text-forest-300 hover:text-forest-100 font-ui underline"
              >
                Forgot password?
              </button>
            </div>

            {error && <p className="text-error text-sm font-ui">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full p-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="bg-forest-900 p-8 rounded-lg space-y-4">
            <p className="font-ui text-sm text-forest-100">
              Enter the email linked to your staff account and we'll send you a link to reset your password.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui placeholder:text-forest-300/60"
              required
            />

            {resetSent && (
              <p className="text-forest-300 text-sm font-ui">
                If that email is registered, a reset link is on its way.
              </p>
            )}
            {error && <p className="text-error text-sm font-ui">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full p-2 rounded bg-forest-500 text-forest-950 font-ui font-semibold"
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
              className="w-full text-xs text-forest-300 hover:text-forest-100 font-ui underline"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
