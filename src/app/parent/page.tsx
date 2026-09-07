"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireRole } from "@/components/auth/require-role";
import { getGuardianRequests, getGuardianStudents } from "@/lib/api/queries";
import { useLoad } from "@/lib/api/use-load";
import { ParentApp } from "@/components/parent/parent-app";
import { ErrorMessage, Skeleton } from "@/components/ui/primitives";

export default function ParentPage() {
  return (
    <Suspense fallback={<ParentSkeleton />}>
      <ParentScreen />
    </Suspense>
  );
}

function ParentScreen() {
  const { session, ready } = useRequireRole(["parent"]);
  const searchParams = useSearchParams();

  const userId = session?.userId ?? null;

  const load = useCallback(async () => {
    if (!userId) return null;
    const students = await getGuardianStudents(userId);
    const requests = await getGuardianRequests(
      students.map((link) => link.student?.id).filter((id): id is string => Boolean(id)),
    );
    return { students, requests };
  }, [userId]);

  const { data, error, loading } = useLoad(load, ready && Boolean(userId));

  if (error) {
    return (
      <main id="main" className="mx-auto w-full max-w-lg px-5 py-16">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Pickup</h1>
        <ErrorMessage className="mt-4">We couldn&apos;t load your students: {error}</ErrorMessage>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Please try again in a moment, or contact the school office if this keeps happening.
        </p>
      </main>
    );
  }

  if (!ready || !session || loading || !data) return <ParentSkeleton />;

  return (
    <ParentApp
      school={session.school}
      guardianName={session.profile.full_name || "there"}
      defaultVehicle={session.profile.vehicle_description}
      students={data.students}
      initialRequests={data.requests}
      autoOpenArrive={searchParams.get("action") === "arrive"}
    />
  );
}

function ParentSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-6">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-6 h-44 rounded-2xl" />
      <Skeleton className="mt-4 h-3 w-28" />
      <div className="mt-3 space-y-2.5">
        <Skeleton className="h-[74px] rounded-2xl" />
        <Skeleton className="h-[74px] rounded-2xl" />
      </div>
    </div>
  );
}
