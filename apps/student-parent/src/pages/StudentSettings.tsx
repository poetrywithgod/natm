import { useAuth } from "../features/auth/AuthContext";

export default function StudentSettings() {
  const { profile, signOut } = useAuth();
  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display text-xl text-abyssal-100">Settings</h1>
      <p className="font-body text-sm text-abyssal-300">{profile?.full_name}</p>
      <button
        onClick={signOut}
        className="px-4 py-2 rounded bg-abyssal-700 text-abyssal-100 font-ui text-sm"
      >
        Sign out
      </button>
    </div>
  );
}
