import type { Metadata } from "next";
import { requireStaff } from "@/server/session";
import { getClassrooms, getStudents } from "@/server/queries/dismissal";
import { getPeople } from "@/server/queries/people";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ClassroomsManager } from "@/components/admin/classrooms-manager";

export const metadata: Metadata = { title: "Classes" };
export const dynamic = "force-dynamic";

export default async function ClassroomsPage() {
  const session = await requireStaff("/classrooms");
  const school = session.school!;
  const isAdmin = session.profile.role === "admin";

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

  return (
    <PageBody>
      <PageHeader
        title="Classes"
        description="Grades, rooms and homeroom teachers. Students inherit their class on the dismissal board."
      />
      <ClassroomsManager
        classrooms={classrooms}
        teachers={teachers}
        studentCounts={studentCounts}
        canEdit={isAdmin}
      />
    </PageBody>
  );
}
