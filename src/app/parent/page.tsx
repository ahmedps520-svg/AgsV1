import type { Metadata } from "next";
import { requireParent } from "@/server/session";
import { getGuardianRequests, getGuardianStudents } from "@/server/queries/dismissal";
import type { GuardianStudent } from "@/server/queries/dismissal";
import { ParentApp } from "@/components/parent/parent-app";
import { ErrorMessage } from "@/components/ui/primitives";
import type { DismissalQueueRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Pickup" };
export const dynamic = "force-dynamic";

export default async function ParentPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const session = await requireParent("/parent");
  const params = await searchParams;

  let students: GuardianStudent[] = [];
  let requests: DismissalQueueRow[] = [];
  let loadError: string | null = null;

  try {
    students = await getGuardianStudents(session.userId);
    requests = await getGuardianRequests(
      students.map((link) => link.student?.id).filter((id): id is string => Boolean(id)),
    );
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown error";
  }

  if (loadError) {
    return (
      <main id="main" className="mx-auto w-full max-w-lg px-5 py-16">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Pickup</h1>
        <ErrorMessage className="mt-4">
          We couldn&apos;t load your students: {loadError}
        </ErrorMessage>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Please try again in a moment, or contact the school office if this keeps happening.
        </p>
      </main>
    );
  }

  return (
    <ParentApp
      school={session.school}
      guardianName={session.profile.full_name || "there"}
      defaultVehicle={session.profile.vehicle_description}
      students={students}
      initialRequests={requests}
      autoOpenArrive={params.action === "arrive"}
    />
  );
}
