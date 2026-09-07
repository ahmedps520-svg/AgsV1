import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { ProfileRow, SchoolRow, UserRole } from "@/lib/types/database";

export interface Session {
  userId: string;
  email: string | null;
  profile: ProfileRow;
  school: SchoolRow | null;
}

/**
 * The signed-in user's profile and school.
 *
 * `cache()` de-duplicates this across a single render pass, so a layout, a page
 * and three server components share one round trip.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  // On a fresh clone there is nothing to sign in to. Treating that as "signed
  // out" routes people to /login, which renders the setup instructions.
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  // getUser() revalidates the JWT with Supabase — never trust getSession() alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

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
});

/** Where each role lands after signing in. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case "parent":
      return "/parent";
    case "display":
      return "/board";
    default:
      return "/dashboard";
  }
}

export async function requireSession(nextPath?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  if (!session.profile.is_active) redirect("/login?error=inactive");
  return session;
}

/** Staff dashboard access (admins included). */
export async function requireStaff(nextPath?: string): Promise<Session> {
  const session = await requireSession(nextPath);
  if (session.profile.role !== "admin" && session.profile.role !== "staff") {
    redirect(homePathForRole(session.profile.role));
  }
  if (!session.school) redirect("/no-school");
  return session;
}

/** School administration (people, settings, roster management). */
export async function requireAdmin(nextPath?: string): Promise<Session> {
  const session = await requireSession(nextPath);
  if (session.profile.role !== "admin") {
    redirect(homePathForRole(session.profile.role));
  }
  if (!session.school) redirect("/no-school");
  return session;
}

/** Read-only board access: staff, admins and dedicated display accounts. */
export async function requireBoardViewer(nextPath?: string): Promise<Session> {
  const session = await requireSession(nextPath);
  if (session.profile.role === "parent") redirect("/parent");
  if (!session.school) redirect("/no-school");
  return session;
}

export async function requireParent(nextPath?: string): Promise<Session> {
  const session = await requireSession(nextPath);
  if (session.profile.role !== "parent") {
    redirect(homePathForRole(session.profile.role));
  }
  return session;
}
