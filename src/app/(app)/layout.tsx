"use client";

import { useRequireRole } from "@/components/auth/require-role";
import { AppShell } from "@/components/layout/app-shell";
import { BRAND } from "@/lib/brand";
import { BootScreen } from "@/components/boot-screen";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, ready } = useRequireRole(["admin", "staff"]);

  if (!ready || !session) return <BootScreen />;

  return (
    <AppShell
      schoolName={session.school?.name ?? BRAND.name}
      userName={session.profile.full_name || session.email || "Staff"}
      userEmail={session.email}
      role={session.profile.role}
    >
      {children}
    </AppShell>
  );
}
