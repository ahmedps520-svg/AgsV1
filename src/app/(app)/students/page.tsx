import type { Metadata } from "next";
import { requireStaff } from "@/server/session";
import { getClassrooms, getGuardiansForStudents, getStudents } from "@/server/queries/dismissal";
import { getPeople } from "@/server/queries/people";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { StudentsManager } from "@/components/admin/students-manager";

export const metadata: Metadata = { title: "Students" };
export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const session = await requireStaff("/students");
  const school = session.school!;
  const isAdmin = session.profile.role === "admin";

  const [students, classrooms] = await Promise.all([
    getStudents(school.id, { limit: 2000 }),
    getClassrooms(school.id),
  ]);

  const [guardianLinks, parents] = await Promise.all([
    getGuardiansForStudents(students.map((student) => student.id)),
    isAdmin ? getPeople(school.id, ["parent"]) : Promise.resolve([]),
  ]);

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

      <StudentsManager
        students={students}
        classrooms={classrooms}
        parents={parents}
        guardianLinks={guardianLinks}
        canEdit={isAdmin}
      />
    </PageBody>
  );
}
