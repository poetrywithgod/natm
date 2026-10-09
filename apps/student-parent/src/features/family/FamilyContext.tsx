import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { fetchLinkedChildren, type LinkedChild } from "../parent/api";

export type AppMode = "parent" | "student";

// The generated database types predate the family-account RPCs, so they are
// called through a loosely typed wrapper.
type LooseRpc = (
  fn: string,
  args?: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const callRpc: LooseRpc = (fn, args) =>
  (supabase.rpc as unknown as LooseRpc).call(supabase, fn, args);

interface FamilyContextValue {
  /** False until the mode and linked children have been loaded for the signed-in account. */
  ready: boolean;
  /** True for parent-role (shared family) accounts, which can switch between modes. */
  isFamilyAccount: boolean;
  /** Current mode for this login session. Legacy student logins are always "student". */
  mode: AppMode | null;
  linkedChildren: LinkedChild[];
  /**
   * The child the app is acting for. null means "look the student up by the
   * signed-in profile" (legacy student logins that have their own account).
   */
  activeStudentId: string | null;
  setActiveStudentId: (id: string) => void;
  switchMode: (next: AppMode) => Promise<{ error: string | null }>;
}

const FamilyContext = createContext<FamilyContextValue | undefined>(undefined);

const storageKey = (profileId: string) => `natm:activeChild:${profileId}`;

function readStoredChild(profileId: string): string | null {
  try {
    return localStorage.getItem(storageKey(profileId));
  } catch {
    return null;
  }
}

function writeStoredChild(profileId: string, studentId: string) {
  try {
    localStorage.setItem(storageKey(profileId), studentId);
  } catch {
    // Storage can be unavailable (private mode); the choice just won't persist.
  }
}

interface FamilyState {
  /** Which account this state was loaded for; stale state is ignored. */
  forProfileId: string | null;
  mode: AppMode;
  linkedChildren: LinkedChild[];
  activeStudentId: string | null;
}

const NOT_LOADED: FamilyState = { forProfileId: null, mode: "parent", linkedChildren: [], activeStudentId: null };

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { profile, loading: authLoading } = useAuth();
  const [state, setState] = useState<FamilyState>(NOT_LOADED);

  const profileId = profile?.id ?? null;
  const role = profile?.role ?? null;

  // Only parent-role (family) accounts need anything loaded; everything else is derived.
  useEffect(() => {
    if (authLoading || !profileId || role !== "parent") return;

    let cancelled = false;
    Promise.all([callRpc("app_session_mode"), fetchLinkedChildren(profileId)])
      .then(([modeRes, kids]) => {
        if (cancelled) return;
        // Anything other than an explicit "student" is parent mode (the safe default).
        const mode: AppMode = !modeRes.error && modeRes.data === "student" ? "student" : "parent";
        const stored = readStoredChild(profileId);
        const active = kids.find((k) => k.id === stored)?.id ?? kids[0]?.id ?? null;
        setState({ forProfileId: profileId, mode, linkedChildren: kids, activeStudentId: active });
      })
      .catch((err) => {
        console.error("Failed to load family context:", err);
        if (!cancelled) setState({ ...NOT_LOADED, forProfileId: profileId });
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, profileId, role]);

  const loaded = role === "parent" && state.forProfileId === profileId;
  const ready = !authLoading && (role !== "parent" || loaded);
  const mode: AppMode | null = role === "student" ? "student" : loaded ? state.mode : null;

  const setActiveStudentId = useCallback(
    (id: string) => {
      if (profileId) writeStoredChild(profileId, id);
      setState((s) => ({ ...s, activeStudentId: id }));
    },
    [profileId]
  );

  const switchMode = useCallback(async (next: AppMode) => {
    const { error } = await callRpc("set_session_mode", { new_mode: next });
    if (error) return { error: error.message };
    setState((s) => ({ ...s, mode: next }));
    return { error: null };
  }, []);

  const value = useMemo<FamilyContextValue>(
    () => ({
      ready,
      isFamilyAccount: role === "parent",
      mode,
      linkedChildren: loaded ? state.linkedChildren : [],
      activeStudentId: loaded ? state.activeStudentId : null,
      setActiveStudentId,
      switchMode,
    }),
    [ready, role, mode, loaded, state.linkedChildren, state.activeStudentId, setActiveStudentId, switchMode]
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within FamilyProvider");
  return ctx;
}
