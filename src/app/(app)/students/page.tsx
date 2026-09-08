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
import { useI18n } from "@/lib/i18n/provider";
import { StudentsManager } from "@/components/admin/students-manager";
import { PromoteCard } from "@/components/admin/promote-card";
import { ErrorMessage, QueueSkeleton } from "@/components/ui/primitives";

export default function StudentsPage() {
  const { session, ready } = useRequireRole(["admin", "staff"]);
  const { t } = useI18n();
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
      <PageHeader title={t("students.title")} description={t(isAdmin ? "students.subtitle" : "students.subtitleReadOnly")} />

      {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

      {loading || !data ? (
        <div className="mt-6">
          <QueueSkeleton rows={5} />
        </div>
      ) : (
        <>
          <StudentsManager
            students={data.students}
            classrooms={data.classrooms}
            parents={data.parents}
            guardianLinks={data.guardianLinks}
            canEdit={Boolean(isAdmin)}
          />

          {/* Moving the whole school up a year rewrites this roster, so it
              lives underneath it rather than buried in school settings. */}
          {isAdmin ? (
            <div className="mt-8 max-w-2xl">
              <PromoteCard />
            </div>
          ) : null}
        </>
      )}
    </PageBody>
  );
}
