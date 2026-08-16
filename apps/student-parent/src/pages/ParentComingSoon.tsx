import { useAuth } from "../features/auth/AuthContext";

export default function ParentComingSoon() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-abyssal-950 p-6 text-center gap-4">
      <h1 className="font-display text-xl text-abyssal-100">Welcome, {profile?.full_name}</h1>
      <p className="font-body text-sm text-abyssal-300 max-w-xs">
        The Parent app is being built next. Check back soon.
      </p>
      <button
        onClick={signOut}
        className="px-4 py-2 rounded bg-abyssal-700 text-abyssal-100 font-ui text-sm"
      >
        Sign out
      </button>
    </div>
  );
}
