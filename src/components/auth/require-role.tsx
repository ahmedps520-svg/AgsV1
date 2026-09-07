"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homePathForRole, useSession, type Session } from "@/lib/api/session";
import type { UserRole } from "@/lib/types/database";

/**
 * Client-side route gate.
 *
 * This is navigation, not security: the real boundary is Row Level Security in
 * Postgres, which returns nothing to a caller who isn't entitled to it. Getting
 * past this guard would show an empty shell, not somebody else's data.
 */
export function useRequireRole(roles: UserRole[] | "any"): {
  session: Session | null;
  ready: boolean;
} {
  const { session, status } = useSession();
  const router = useRouter();

  const allowed =
    session !== null && (roles === "any" || roles.includes(session.profile.role));

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!allowed) router.replace(homePathForRole(session.profile.role));
  }, [status, session, allowed, router]);

  return { session, ready: status !== "loading" && allowed };
}

export function RoleGate({
  roles,
  children,
  fallback,
}: {
  roles: UserRole[] | "any";
  children: (session: Session) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { session, ready } = useRequireRole(roles);

  if (!ready || !session) return <>{fallback ?? null}</>;
  return <>{children(session)}</>;
}
