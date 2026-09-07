"use client";

import { useCallback } from "react";
import { useRequireRole } from "@/components/auth/require-role";
import {
  getClassrooms,
  getGuardiansForStudents,
  getPeople,
  getStudents,
} from "@/lib/api/queries";
import { useLoad } from "@/lib/api/use-load";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StudentsManager } from "@/components/admin/students-manager";
import { ErrorMessage, QueueSkeleton } from "@/components/ui/primitives";

export default function StudentsPage() {
  const { session, ready } = useRequireRole(["admin", "staff"]);
  const school = session?.school ?? null;
  const isAdmin = session?.profile.role === "admin";

  const load = useCallback(async () => {
    if (!school) return null;
    const [students, classrooms] = await Promise.all([
      getStudents(school.id, { limit: 2000 }),
      getClassrooms(school.id),
    ]);
    const [guardianLinks, parents] = await Promise.all([
      getGuardiansForStudents(students.map((student) => student.id)),
      isAdmin ? getPeople(school.id, ["parent"]) : Promise.resolve([]),
    ]);
    return { students, classrooms, guardianLinks, parents };
  }, [school, isAdmin]);

  const { data, error, loading } = useLoad(load, ready && Boolean(school));

  return (
    <PageBody>
      <PageHeader
        title="Students"
        description={
          isAdmin
            ? "Your roster, their classes, and who is allowed to collect them."
            : "Your roster. Ask an administrator to make changes."
        }
      />

      {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

      {loading || !data ? (
        <div className="mt-6">
          <QueueSkeleton rows={5} />
        </div>
      ) : (
        <StudentsManager
          students={data.students}
          classrooms={data.classrooms}
          parents={data.parents}
          guardianLinks={data.guardianLinks}
          canEdit={Boolean(isAdmin)}
        />
      )}
    </PageBody>
  );
}
