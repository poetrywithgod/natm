import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-abyssal-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-abyssal-900 p-8 rounded-lg space-y-4">
        <h1 className="font-display text-xl text-abyssal-100">Set a New Password</h1>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 rounded bg-abyssal-700 text-abyssal-100 font-ui placeholder:text-abyssal-300/60"
          required
          minLength={6}
        />
        {error && <p className="text-error text-sm font-ui">{error}</p>}
        {done && <p className="text-lime text-sm font-ui">Password updated. Redirecting...</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full p-2 rounded bg-lime text-abyssal-950 font-ui font-semibold"
        >
          {submitting ? "Saving..." : "Save Password"}
        </button>
      </form>
    </div>
  );
}
