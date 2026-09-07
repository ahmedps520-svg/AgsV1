import type { Metadata } from "next";
import { requireAdmin } from "@/server/session";
import { getGuardianLinksBySchool, getPeople } from "@/server/queries/people";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { PeopleManager } from "@/components/admin/people-manager";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const session = await requireAdmin("/people");
  const school = session.school!;

  const [people, guardianLinks] = await Promise.all([
    getPeople(school.id, ["admin", "staff", "parent", "display"]),
    getGuardianLinksBySchool(school.id),
  ]);

  return (
    <PageBody>
      <PageHeader
        title="People"
        description="Teachers, administrators, parents, authorised drivers and display accounts. Pickup permissions are set per student on the Students page."
      />
      <PeopleManager
        people={people}
        guardianLinks={guardianLinks}
        currentUserId={session.userId}
      />
    </PageBody>
  );
}
