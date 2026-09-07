import type { Metadata } from "next";
import { requireStaff } from "@/server/session";
import { getHistory, schoolToday } from "@/server/queries/dismissal";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { HistoryView } from "@/components/admin/history-view";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireStaff("/history");
  const school = session.school!;
  const params = await searchParams;

  const date =
    params.date && DATE_PATTERN.test(params.date) ? params.date : schoolToday(school.timezone);

  const rows = await getHistory(school.id, date);

  const pickedUp = rows.filter((row) => row.status === "picked_up").length;

  return (
    <PageBody>
      <PageHeader
        title="History"
        description={`${formatDate(`${date}T12:00:00Z`, school.timezone)} · ${rows.length} request${
          rows.length === 1 ? "" : "s"
        }, ${pickedUp} completed.`}
      />
      <HistoryView rows={rows} date={date} timeZone={school.timezone} />
    </PageBody>
  );
}
