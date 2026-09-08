"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homePathForRole, useSession } from "@/lib/api/session";
import { BootScreen } from "@/components/boot-screen";

/**
 * There is no marketing page: staff open the app to sign in, and everyone
 * already signed in goes straight to their boards.
 */
export default function HomePage() {
  const { session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    router.replace(session ? homePathForRole(session.profile.role) : "/login");
  }, [session, status, router]);

  return <BootScreen />;
}
