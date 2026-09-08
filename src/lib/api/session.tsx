"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { IS_CONFIGURED } from "@/lib/api/config";
import type { ProfileRow, SchoolRow, SectionScope, UserRole } from "@/lib/types/database";

export interface Session {
  userId: string;
  email: string | null;
  profile: ProfileRow;
  school: SchoolRow | null;
  /** Which classes this account may open. */
  scope: SectionScope;
}

interface SessionContextValue {
  session: Session | null;
  status: "loading" | "authenticated" | "anonymous";
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

/** Where each role lands after signing in. */
export function homePathForRole(role: UserRole): string {
  return role === "parent" ? "/parent" : "/board";
}

async function loadSession(): Promise<Session | null> {
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

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    school,
    scope: profile.section_scope ?? "all",
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [status, setStatus] = React.useState<SessionContextValue["status"]>(
    IS_CONFIGURED ? "loading" : "anonymous",
  );

  const refresh = React.useCallback(async () => {
    if (!IS_CONFIGURED) return;
    const next = await loadSession();
    setSession(next);
    setStatus(next ? "authenticated" : "anonymous");
  }, []);

  React.useEffect(() => {
    if (!IS_CONFIGURED) return;

    // Deferred a tick so the first resolve lands after this effect commits.
    queueMicrotask(() => void refresh());

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
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        // Never reveal whether the address exists.
        return {
          error: error.message.toLowerCase().includes("invalid")
            ? "invalid"
            : error.message,
        };
      }

      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const signOut = React.useCallback(async () => {
    await createClient().auth.signOut();
    setSession(null);
    setStatus("anonymous");
  }, []);

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
