import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@natm/supabase";
import { supabase } from "../../lib/supabase";

interface Profile {
  id: string;
  full_name: string;
  photo_url: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  // Set when a real session exists but the signed-in account is not a
  // super_admin -- lets the login screen show a clear "not authorized"
  // message instead of silently failing or (worse) landing them in a
  // half-working dashboard with no data they're allowed to see.
  notAuthorized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);

  // super_admin rows have no school_id (see initial_schema.sql), so this
  // is the only role check this app needs -- role itself is the gate.
  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, full_name, photo_url")
      .eq("id", userId)
      .single();
    if (error || !data || data.role !== "super_admin") {
      setProfile(null);
      setNotAuthorized(true);
      await supabase.auth.signOut();
      return;
    }
    setNotAuthorized(false);
    setProfile({ id: data.id, full_name: data.full_name, photo_url: data.photo_url });
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    setNotAuthorized(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }
  async function signOut() {
    await supabase.auth.signOut();
  }
  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, notAuthorized, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
