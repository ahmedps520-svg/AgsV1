"use client";

import { Suspense, useCallback, useState } from "react";
import { useRequireRole } from "@/components/auth/require-role";
import { getHistory, schoolToday } from "@/lib/api/queries";
import { useLoad } from "@/lib/api/use-load";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { HistoryView } from "@/components/admin/history-view";
import { ErrorMessage, QueueSkeleton } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryScreen />
    </Suspense>
  );
}

function HistoryScreen() {
  const { session, ready } = useRequireRole(["admin", "staff"]);
  const { t, locale } = useI18n();
  const school = session?.school ?? null;

  const [date, setDate] = useState<string | null>(null);
  const effectiveDate = date ?? (school ? schoolToday(school.timezone) : "");

  const load = useCallback(async () => {
    if (!school || !effectiveDate) return null;
    return getHistory(school.id, effectiveDate);
  }, [school, effectiveDate]);

  const { data, error, loading } = useLoad(load, ready && Boolean(school));

  const pickedUp = (data ?? []).filter((row) => row.status === "picked_up").length;

  return (
    <PageBody>
      <PageHeader
        title={t("history.title")}
        description={
          school && effectiveDate
            ? `${formatDate(`${effectiveDate}T12:00:00Z`, school.timezone, locale)} · ${t("history.summary", { count: data?.length ?? 0, done: pickedUp })}`
            : t("history.subtitle")
        }
      />

      {error ? <ErrorMessage className="mt-5">{error}</ErrorMessage> : null}

      {loading || !data || !school ? (
        <div className="mt-6">
          <QueueSkeleton rows={4} />
        </div>
      ) : (
        <HistoryView
          rows={data}
          date={effectiveDate}
          timeZone={school.timezone}
          onDateChange={setDate}
        />
      )}
    </PageBody>
  );
}
