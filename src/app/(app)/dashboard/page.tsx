"use client";

import { useCallback } from "react";
import { useRequireRole } from "@/components/auth/require-role";
import { getQueue, getStudents, schoolToday } from "@/lib/api/queries";
import { useLoad } from "@/lib/api/use-load";
import { DismissalDashboard } from "@/components/dismissal/dashboard";
import { ErrorMessage, QueueSkeleton, Skeleton } from "@/components/ui/primitives";

export default function DashboardPage() {
  const { session, ready } = useRequireRole(["admin", "staff"]);
  const school = session?.school ?? null;
  const today = school ? schoolToday(school.timezone) : "";

  const load = useCallback(async () => {
    if (!school) return null;
    const [queue, students] = await Promise.all([
      getQueue(school.id, today),
      getStudents(school.id, { limit: 2000 }),
    ]);
    return { queue, students };
  }, [school, today]);

  const { data, error, loading } = useLoad(load, ready && Boolean(school));

  if (!ready || !school) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Dismissal</h1>
        <ErrorMessage className="mt-4">We couldn&apos;t load the queue: {error}</ErrorMessage>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Check that the migrations in <code className="font-mono">supabase/migrations</code> have
          been applied to your project, then reload this page.
        </p>
      </div>
    );
  }

  if (loading || !data) return <DashboardSkeleton />;

  return (
    <DismissalDashboard
      school={school}
      initialQueue={data.queue}
      students={data.students}
      today={today}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <Skeleton className="h-9 w-52" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-5">
        <QueueSkeleton rows={4} />
      </div>
    </div>
  );
}
