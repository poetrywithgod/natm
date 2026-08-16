import { useAuth } from "../features/auth/AuthContext";

export default function StudentHome() {
  const { profile } = useAuth();
  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display text-xl text-abyssal-100">
        Welcome back, {profile?.full_name?.split(" ")[0] ?? "there"}!
      </h1>
      <p className="font-body text-sm text-abyssal-300">
        Your lessons, assignments, and progress will show up here soon.
      </p>
    </div>
  );
}
