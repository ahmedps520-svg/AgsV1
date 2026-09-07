"use client";

import { useCallback } from "react";
import { useRequireRole } from "@/components/auth/require-role";
import { getGuardianLinksBySchool, getPeople } from "@/lib/api/queries";
import { useLoad } from "@/lib/api/use-load";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { useI18n } from "@/lib/i18n/provider";
import { PeopleManager } from "@/components/admin/people-manager";
import { ErrorMessage, QueueSkeleton } from "@/components/ui/primitives";

export default function PeoplePage() {
  const { session, ready } = useRequireRole(["admin"]);
  const { t } = useI18n();
  const school = session?.school ?? null;

  const load = useCallback(async () => {
    if (!school) return null;
    const [people, guardianLinks] = await Promise.all([
      getPeople(school.id, ["admin", "staff", "parent"]),
      getGuardianLinksBySchool(school.id),
    ]);
    return { people, guardianLinks };
  }, [school]);

  const { data, error, loading } = useLoad(load, ready && Boolean(school));

  return (
    <PageBody>
      <PageHeader title={t("people.title")} description={t("people.subtitle")} />

      {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

      {loading || !data || !session ? (
        <div className="mt-6">
          <QueueSkeleton rows={4} />
        </div>
      ) : (
        <PeopleManager
          people={data.people}
          guardianLinks={data.guardianLinks}
          currentUserId={session.userId}
        />
      )}
    </PageBody>
  );
}
