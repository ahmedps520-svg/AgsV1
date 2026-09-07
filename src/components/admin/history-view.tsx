"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/dismissal/status-badge";
import { describeSource, studentSubtitle } from "@/lib/dismissal";
import { formatTime } from "@/lib/utils";
import type { DismissalQueueRow } from "@/lib/types/database";

export function HistoryView({
  rows,
  date,
  timeZone,
}: {
  rows: DismissalQueueRow[];
  date: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [term, setTerm] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.student_name, row.student_grade, row.classroom_name, row.pickup_number, row.guardian_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, term]);

  function exportCsv() {
    const header = [
      "Student",
      "Grade",
      "Class",
      "Pickup number",
      "Status",
      "Requested by",
      "Requested at",
      "Called at",
      "Ready at",
      "Picked up at",
    ];

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const lines = [
      header.map(escape).join(","),
      ...filtered.map((row) =>
        [
          row.student_name,
          row.student_grade ?? "",
          row.classroom_name ?? "",
          row.pickup_number ?? "",
          row.status,
          row.guardian_name ?? "",
          formatTime(row.requested_at, timeZone),
          formatTime(row.called_at, timeZone),
          formatTime(row.ready_at, timeZone),
          formatTime(row.picked_up_at, timeZone),
        ]
          .map((value) => escape(String(value)))
          .join(","),
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dismissals-${date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Input
          type="date"
          value={date}
          max={new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date())}
          onChange={(event) => router.push(`/history?date=${event.target.value}`)}
          aria-label="Choose a date"
          className="w-auto"
        />

        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search this day…"
            aria-label="Search dismissals"
            className="pl-10"
          />
        </div>

        <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={CalendarClock}
          title={rows.length === 0 ? "No dismissals on this day" : "Nothing matches that search"}
          description={
            rows.length === 0
              ? "Pick another date, or come back after the next pickup window."
              : "Try a student name, class or pickup number."
          }
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)]">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] text-[12px] uppercase tracking-wide text-[var(--color-muted)]">
                  <th scope="col" className="px-4 py-3 font-semibold">Student</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Requested by</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Arrived</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Called</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Ready</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Picked up</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-hairline)] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.student_name} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{row.student_name}</p>
                          <p className="truncate text-[12.5px] text-[var(--color-muted)]">
                            {studentSubtitle(row)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[var(--color-muted)]">
                      {describeSource(row)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="tabular px-4 py-3 text-right text-[13px]">
                      {formatTime(row.requested_at, timeZone) || "—"}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-[13px]">
                      {formatTime(row.called_at, timeZone) || "—"}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-[13px]">
                      {formatTime(row.ready_at, timeZone) || "—"}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-[13px]">
                      {formatTime(row.picked_up_at, timeZone) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
