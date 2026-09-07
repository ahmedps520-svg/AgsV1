import { requireStaff } from "@/server/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();

  return (
    <AppShell
      schoolName={session.school?.name ?? "Map Dismissals"}
      userName={session.profile.full_name || session.email || "Staff"}
      userEmail={session.email}
      role={session.profile.role}
    >
      {children}
    </AppShell>
  );
}
