"use client";

import * as React from "react";
import { CalendarClock, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";
import { boardState } from "@/lib/dismissal";
import { cn, formatTime } from "@/lib/utils";
import type { DismissalQueueRow } from "@/lib/types/database";

export function HistoryView({
  rows,
  date,
  timeZone,
  onDateChange,
}: {
  rows: DismissalQueueRow[];
  date: string;
  timeZone: string;
  onDateChange: (date: string) => void;
}) {
  const { t, locale } = useI18n();
  const [term, setTerm] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.student_name, row.classroom_name, row.guardian_name].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [rows, term]);

  function exportCsv() {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ["Student", "Class", "Called by", "Status", "Called at", "Dismissed at"];
    const lines = [
      header.map(escape).join(","),
      ...filtered.map((row) =>
        [
          row.student_name,
          row.classroom_name ?? "",
          row.guardian_name ?? "",
          row.status,
          formatTime(row.called_at ?? row.requested_at, timeZone, locale),
          formatTime(row.picked_up_at, timeZone, locale),
        ]
          .map((value) => escape(String(value)))
          .join(","),
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dismissal-${date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const statusPill = (row: DismissalQueueRow) => {
    const state = row.status === "cancelled" ? "cancelled" : boardState(row);
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wide ring-1 ring-inset",
          state === "called" && "bg-gold-100 text-gold-900 ring-gold-600/25 dark:bg-gold-500/15 dark:text-gold-200",
          state === "dismissed" && "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-white/10 dark:text-slate-300",
          state === "cancelled" && "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
          state === "present" && "bg-black/[0.05] text-[var(--color-muted)] ring-transparent",
        )}
      >
        {t(`status.${row.status}`)}
      </span>
    );
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Input
          type="date"
          value={date}
          max={new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date())}
          onChange={(event) => onDateChange(event.target.value)}
          aria-label={t("common.today")}
          className="w-auto"
          dir="ltr"
        />
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("history.searchPlaceholder")}
            aria-label={t("common.search")}
            className="ps-10"
          />
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="size-4" />
          {t("history.export")}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={CalendarClock}
          title={t(rows.length === 0 ? "history.empty" : "history.noMatch")}
          description={rows.length === 0 ? t("history.emptyHint") : undefined}
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)]">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-[40rem] text-start text-sm">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] text-[12px] uppercase tracking-wide text-[var(--color-muted)]">
                  <th scope="col" className="px-4 py-3 text-start font-semibold">{t("history.col.student")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">{t("history.col.class")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">{t("history.col.calledBy")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-semibold">{t("history.col.status")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{t("history.col.called")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{t("history.col.dismissed")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--color-hairline)] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.student_name} size="xs" />
                        <p className="truncate font-semibold">{row.student_name}</p>
                      </div>
                    </td>
                    <td className="code px-4 py-3 font-semibold text-brand-700 dark:text-brand-300">{row.classroom_name ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-[var(--color-muted)]">{row.guardian_name ?? "—"}</td>
                    <td className="px-4 py-3">{statusPill(row)}</td>
                    <td className="tabular px-4 py-3 text-end text-[13px]">{formatTime(row.called_at ?? row.requested_at, timeZone, locale) || "—"}</td>
                    <td className="tabular px-4 py-3 text-end text-[13px]">{formatTime(row.picked_up_at, timeZone, locale) || "—"}</td>
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
