import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchSchoolInfo, type SchoolInfo } from "../features/schools/api";

const QUOTES = [
  { text: "Autism is part of who I am.", source: "Temple Grandin" },
  { text: "If you've met one person with autism, you've met one person with autism.", source: "Dr. Stephen Shore" },
  { text: "Every mind learns differently — and every different mind matters." },
  { text: "Progress isn't measured by speed. It's measured by growth." },
  { text: "Understanding grows one patient step at a time." },
  { text: "Every child's way of learning deserves to be seen and supported." },
  { text: "Small steps, taken consistently, lead to real change." },
  { text: "Different doesn't mean less — it means uniquely capable." },
  { text: "Patience and belief turn potential into progress." },
  { text: "Today is another step forward, in your own way, at your own pace." },
];

export default function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "forgot-password">("sign-in");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  useEffect(() => {
    const schoolId = import.meta.env.VITE_SCHOOL_ID as string | undefined;
    if (schoolId) fetchSchoolInfo(schoolId).then(setSchoolInfo);
  }, []);

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
    <div className="min-h-screen flex items-center justify-center bg-abyssal-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          {schoolInfo?.logo_url ? (
            <img src={schoolInfo.logo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <img
              src="/logo.svg"
              alt=""
              className="h-16 w-16 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div>
            <h1 className="font-display text-2xl text-abyssal-100">
              {schoolInfo?.name ?? "NATM Portal"}
            </h1>
            <p className="font-body text-sm text-abyssal-300 mt-1">
              Welcome back. Sign in to continue your learning journey.
            </p>
          </div>
        </div>

        <div className="bg-abyssal-900/60 border border-abyssal-700 rounded-lg px-4 py-3 text-center">
          <p className="font-body text-sm italic text-abyssal-100">"{quote.text}"</p>
          {quote.source && (
            <p className="font-ui text-xs text-abyssal-300 mt-1">— {quote.source}</p>
          )}
        </div>

        {mode === "sign-in" ? (
          <form onSubmit={handleSignIn} className="bg-abyssal-900 p-8 rounded-lg space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-abyssal-700 text-abyssal-100 font-ui placeholder:text-abyssal-300/60"
              required
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 pr-10 rounded bg-abyssal-700 text-abyssal-100 font-ui placeholder:text-abyssal-300/60"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-abyssal-300"
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
                className="text-xs text-abyssal-300 hover:text-abyssal-100 font-ui underline"
              >
                Forgot password?
              </button>
            </div>

            {error && <p className="text-error text-sm font-ui">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full p-2 rounded bg-lime text-abyssal-950 font-ui font-semibold hover:bg-lime-dark active:scale-95 transition-transform transition-colors duration-150 disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="bg-abyssal-900 p-8 rounded-lg space-y-4">
            <p className="font-ui text-sm text-abyssal-100">
              Enter the email linked to your account and we'll send you a link to reset your password.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-abyssal-700 text-abyssal-100 font-ui placeholder:text-abyssal-300/60"
              required
            />

            {resetSent && (
              <p className="text-abyssal-300 text-sm font-ui">
                If that email is registered, a reset link is on its way.
              </p>
            )}
            {error && <p className="text-error text-sm font-ui">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full p-2 rounded bg-lime text-abyssal-950 font-ui font-semibold hover:bg-lime-dark active:scale-95 transition-transform transition-colors duration-150 disabled:opacity-60"
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
              className="w-full text-xs text-abyssal-300 hover:text-abyssal-100 font-ui underline"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
