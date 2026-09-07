import type { Metadata } from "next";
import { requireStaff } from "@/server/session";
import { getQueue, getStudents, schoolToday } from "@/server/queries/dismissal";
import type { StudentWithClassroom } from "@/server/queries/dismissal";
import { DismissalDashboard } from "@/components/dismissal/dashboard";
import { ErrorMessage } from "@/components/ui/primitives";
import type { DismissalQueueRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Dismissal" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireStaff("/dashboard");
  const school = session.school!;
  const today = schoolToday(school.timezone);

  let queue: DismissalQueueRow[] = [];
  let students: StudentWithClassroom[] = [];
  let loadError: string | null = null;

  try {
    [queue, students] = await Promise.all([
      getQueue(school.id, today),
      getStudents(school.id, { limit: 2000 }),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown error";
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Dismissal</h1>
        <ErrorMessage className="mt-4">We couldn&apos;t load the queue: {loadError}</ErrorMessage>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Check that the migrations in <code className="font-mono">supabase/migrations</code> have
          been applied to your project, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <DismissalDashboard school={school} initialQueue={queue} students={students} today={today} />
  );
}
