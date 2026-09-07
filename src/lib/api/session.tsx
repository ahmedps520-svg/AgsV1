"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO } from "@/lib/api/config";
import {
  demoCurrentProfile,
  demoSignIn,
  demoSignOut,
  demoState,
  subscribeDemo,
} from "@/lib/api/demo-store";
import type { ProfileRow, SchoolRow, UserRole } from "@/lib/types/database";

export interface Session {
  userId: string;
  email: string | null;
  profile: ProfileRow;
  school: SchoolRow | null;
}

interface SessionContextValue {
  session: Session | null;
  /** `loading` until we know whether anyone is signed in. */
  status: "loading" | "authenticated" | "anonymous";
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

/** Where each role lands after signing in. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case "parent":
      return "/parent";
    default:
      return "/board";
  }
}

async function loadSupabaseSession(): Promise<Session | null> {
  const supabase = createClient();

  // getUser() revalidates the token with Supabase rather than trusting storage.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  let school: SchoolRow | null = null;
  if (profile.school_id) {
    const { data } = await supabase
      .from("schools")
      .select("*")
      .eq("id", profile.school_id)
      .maybeSingle();
    school = data ?? null;
  }

  return { userId: user.id, email: user.email ?? profile.email, profile, school };
}

async function loadDemoSession(): Promise<Session | null> {
  const profile = demoCurrentProfile();
  if (!profile) return null;
  return {
    userId: profile.id,
    email: profile.email,
    profile,
    school: demoState().school,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [status, setStatus] = React.useState<SessionContextValue["status"]>("loading");

  const refresh = React.useCallback(async () => {
    const next = IS_DEMO ? await loadDemoSession() : await loadSupabaseSession();
    setSession(next);
    setStatus(next ? "authenticated" : "anonymous");
  }, []);

  React.useEffect(() => {
    // Deferred a tick so the first resolve lands after this effect commits.
    queueMicrotask(() => void refresh());

    if (IS_DEMO) {
      // Keep the signed-in profile in step when another tab edits the school.
      return subscribeDemo(() => void refresh());
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        void refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  const signIn = React.useCallback<SessionContextValue["signIn"]>(
    async (email, password) => {
      if (IS_DEMO) {
        const profile = demoSignIn(email);
        if (!profile) {
          return { error: "Pick one of the demo accounts listed below to explore the app." };
        }
        await refresh();
        return { error: null };
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Never reveal whether the address exists.
        return {
          error: error.message.toLowerCase().includes("invalid")
            ? "That email and password don't match. Please try again."
            : error.message,
        };
      }

      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const signOut = React.useCallback(async () => {
    if (IS_DEMO) demoSignOut();
    else await createClient().auth.signOut();
    await refresh();
  }, [refresh]);

  const value = React.useMemo<SessionContextValue>(
    () => ({ session, status, refresh, signIn, signOut }),
    [session, status, refresh, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>.");
  return context;
}
