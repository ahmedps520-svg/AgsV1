"use client";

import { useCallback } from "react";
import { useRequireRole } from "@/components/auth/require-role";
import { getClassrooms, getPeople, getStudents } from "@/lib/api/queries";
import { useLoad } from "@/lib/api/use-load";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { useI18n } from "@/lib/i18n/provider";
import { ClassroomsManager } from "@/components/admin/classrooms-manager";
import { ErrorMessage, QueueSkeleton } from "@/components/ui/primitives";

export default function ClassroomsPage() {
  const { session, ready } = useRequireRole(["admin", "staff"]);
  const { t } = useI18n();
  const school = session?.school ?? null;
  const isAdmin = session?.profile.role === "admin";

  const load = useCallback(async () => {
    if (!school) return null;
    const [classrooms, students, teachers] = await Promise.all([
      getClassrooms(school.id),
      getStudents(school.id, { limit: 2000 }),
      getPeople(school.id, ["admin", "staff"]),
    ]);

    const studentCounts: Record<string, number> = {};
    for (const student of students) {
      if (student.classroom_id) {
        studentCounts[student.classroom_id] = (studentCounts[student.classroom_id] ?? 0) + 1;
      }
    }

    return { classrooms, teachers, studentCounts };
  }, [school]);

  const { data, error, loading } = useLoad(load, ready && Boolean(school));

  return (
    <PageBody>
      <PageHeader title={t("classes.title")} description={t("classes.subtitle")} />

      {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

      {loading || !data ? (
        <div className="mt-6">
          <QueueSkeleton rows={3} />
        </div>
      ) : (
        <ClassroomsManager
          classrooms={data.classrooms}
          teachers={data.teachers}
          studentCounts={data.studentCounts}
          canEdit={Boolean(isAdmin)}
        />
      )}
    </PageBody>
  );
}
