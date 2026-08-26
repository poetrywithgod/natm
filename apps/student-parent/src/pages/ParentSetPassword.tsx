import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";

export default function ParentSetPassword() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const { error: flagError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", profile.id);
      if (flagError) {
        setError(flagError.message);
        setSubmitting(false);
        return;
      }
      await refreshProfile();
      navigate("/parent", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set password");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-abyssal-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-abyssal-900 p-8 rounded-lg space-y-4">
        <div>
          <h1 className="font-display text-xl text-abyssal-100">Set Your Password</h1>
          <p className="font-body text-sm text-abyssal-300 mt-1">
            Welcome! Choose a password only you will know to secure your account.
          </p>
        </div>

        <div className="relative">
          <label htmlFor="new-parent-password" className="sr-only">New password</label>
          <input
            id="new-parent-password"
            name="new-parent-password"
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
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="relative">
          <label htmlFor="confirm-parent-password" className="sr-only">Confirm password</label>
          <input
            id="confirm-parent-password"
            name="confirm-parent-password"
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
