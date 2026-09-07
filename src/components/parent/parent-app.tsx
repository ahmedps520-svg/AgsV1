"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Car, CircleUser, Hand, Info, MessageSquareText, ShieldAlert, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { Avatar, EmptyState, ErrorMessage, LiveDot } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useLiveQueue } from "@/hooks/use-live-queue";
import { useNow } from "@/hooks/use-now";
import { getGuardianRequests } from "@/lib/api/queries";
import { cancelRequestAction } from "@/lib/api/mutations";
import { useI18n } from "@/lib/i18n/provider";
import { boardState, isActive } from "@/lib/dismissal";
import { classLabel } from "@/lib/classes";
import { cn, formatTime, timeAgo } from "@/lib/utils";
import { StatusTracker } from "@/components/parent/status-tracker";
import { ArriveSheet } from "@/components/parent/arrive-sheet";
import { InstallHint } from "@/components/parent/install-hint";
import { LanguageToggle } from "@/components/language-toggle";
import { LogoMark } from "@/components/logo";
import { BRAND } from "@/lib/brand";
import type { DismissalQueueRow, SchoolRow } from "@/lib/types/database";
import type { GuardianStudent } from "@/lib/api/queries";

function greetingKey(date: Date, timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(date));
  if (hour < 12) return "parent.greeting.morning" as const;
  if (hour < 17) return "parent.greeting.afternoon" as const;
  return "parent.greeting.evening" as const;
}

export function ParentApp({
  school,
  guardianName,
  defaultVehicle,
  students,
  initialRequests,
  autoOpenArrive,
}: {
  school: Pick<SchoolRow, "id" | "name" | "timezone" | "allow_parent_cancel" | "board_message"> | null;
  guardianName: string;
  defaultVehicle: string | null;
  students: GuardianStudent[];
  initialRequests: DismissalQueueRow[];
  autoOpenArrive: boolean;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const now = useNow(1000);
  const timeZone = school?.timezone ?? "UTC";

  const studentIds = React.useMemo(
    () => students.map((link) => link.student?.id).filter((id): id is string => Boolean(id)),
    [students],
  );
  const load = React.useCallback(() => getGuardianRequests(studentIds), [studentIds]);

  const { rows, connection, refresh, error } = useLiveQueue<DismissalQueueRow>({
    channelName: `parent-requests:${studentIds.join("-").slice(0, 60) || "none"}`,
    filter: school ? `school_id=eq.${school.id}` : undefined,
    initial: initialRequests,
    load,
  });

  const [arriveOpen, setArriveOpen] = React.useState(autoOpenArrive);
  const [cancelTarget, setCancelTarget] = React.useState<DismissalQueueRow | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const active = React.useMemo(
    () => rows.filter((row) => isActive(row.status)).sort((a, b) => b.requested_at.localeCompare(a.requested_at)),
    [rows],
  );

  const finishedToday = React.useMemo(() => {
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return rows
      .filter((row) => !isActive(row.status) && row.dismissal_date === todayKey)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [rows, timeZone]);

  const activeStudentIds = React.useMemo(() => new Set(active.map((row) => row.student_id)), [active]);

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    const result = await cancelRequestAction({ requestId: cancelTarget.id });
    setCancelling(false);
    setCancelTarget(null);
    if (!result.ok) {
      toast.error(t("board.toast.failed"), result.error);
      return;
    }
    toast.success(t("parent.cancelledToast"), t("parent.cancelledToastBody"));
    void refresh();
  }

  const canArrive = students.some((link) => link.can_pickup && link.student && !activeStudentIds.has(link.student.id));

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-canvas)]">
      <header className="glass sticky top-0 z-30 border-b border-[var(--color-hairline)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3">
          <LogoMark className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.02em]">{school?.name ?? BRAND.name}</p>
            <p className="flex items-center gap-1.5 truncate text-[12px] text-[var(--color-muted)]">
              <LiveDot connected={connection === "live"} />
              {t(connection === "live" ? "common.live" : "common.reconnecting")}
            </p>
          </div>
          <LanguageToggle />
          <Link href="/account" aria-label={t("common.account")} className="rounded-xl p-2 text-[var(--color-muted)] transition hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10">
            <CircleUser className="size-6" />
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 pb-40 pt-5">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-gold-800 dark:bg-gold-500/15 dark:text-gold-200">
          <Smartphone className="size-3.5" />
          {t("parent.previewBadge")}
        </p>

        <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-[-0.03em]">
          {t(greetingKey(new Date(now), timeZone))}، {guardianName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--color-muted)]">{t(active.length > 0 ? "parent.hintActive" : "parent.hintIdle")}</p>

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        <AnimatePresence initial={false}>
          {active.length > 0 ? (
            <motion.section key="active" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
              <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">{t("parent.inProgress")}</h2>
              <div className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {active.map((row) => (
                    <RequestCard
                      key={row.id}
                      row={row}
                      now={now}
                      timeZone={timeZone}
                      allowCancel={school?.allow_parent_cancel ?? true}
                      onCancel={() => setCancelTarget(row)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <section className="mt-7" aria-label={t("parent.yourStudents")}>
          <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">{t("parent.yourStudents")}</h2>
          {students.length === 0 ? (
            <EmptyState icon={ShieldAlert} title={t("parent.noStudents")} description={t("parent.noStudentsHint")} />
          ) : (
            <ul className="space-y-2.5">
              {students.map((link) => {
                const student = link.student!;
                const name = `${student.first_name} ${student.last_name}`.trim();
                const current = active.find((row) => row.student_id === student.id);
                const state = current ? boardState(current) : null;
                return (
                  <li key={link.id} className="surface-card flex items-center gap-3.5 p-3.5">
                    <Avatar name={name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15.5px] font-bold tracking-[-0.01em]">{name}</p>
                      <p className="truncate text-[13px] text-[var(--color-muted)]">
                        {student.classroom ? (
                          <>
                            <span className="code font-semibold">{student.classroom.name}</span> · {classLabel(student.classroom, locale)}
                          </>
                        ) : (
                          t("students.noClass")
                        )}
                      </p>
                    </div>
                    {state === "called" ? (
                      <span className="shrink-0 rounded-full bg-[var(--color-called)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-called-ink)]">
                        {t("parent.status.called")}
                      </span>
                    ) : !link.can_pickup ? (
                      <span className="shrink-0 rounded-full bg-black/[0.06] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-muted)] dark:bg-white/[0.08]">
                        {t("parent.notAuthorised")}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {finishedToday.length > 0 ? (
          <section className="mt-7" aria-label={t("parent.earlierToday")}>
            <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">{t("parent.earlierToday")}</h2>
            <ul className="space-y-2">
              {finishedToday.map((row) => (
                <li key={row.id} className="flex items-center gap-3 rounded-xl bg-[var(--color-surface)] px-3.5 py-3 ring-1 ring-[var(--color-hairline)]">
                  <CalendarClock className="size-4 shrink-0 text-[var(--color-muted)]" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{row.student_name}</span>
                  <span className="tabular shrink-0 text-[12.5px] text-[var(--color-muted)]">
                    {t(`status.${row.status}`)}
                    {row.picked_up_at ? ` · ${formatTime(row.picked_up_at, timeZone, locale)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-7 flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5 text-[13px] leading-relaxed text-brand-900 ring-1 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-400/20">
          <Info className="mt-0.5 size-4 shrink-0" />
          {school?.board_message ?? t("parent.previewNote")}
        </p>

        <InstallHint />
      </main>

      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-hairline)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto w-full max-w-lg">
          <Button size="xl" className="w-full" onClick={() => setArriveOpen(true)} disabled={!canArrive || students.length === 0}>
            <Hand className="size-5" />
            {students.length === 0 ? t("parent.noneLinked") : canArrive ? t("parent.imHere") : t("parent.allCalled")}
          </Button>
        </div>
      </div>

      <ArriveSheet
        open={arriveOpen}
        onClose={() => setArriveOpen(false)}
        students={students}
        defaultVehicle={defaultVehicle}
        activeStudentIds={activeStudentIds}
        onDone={() => void refresh()}
      />

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        variant="sheet"
        title={cancelTarget ? t("parent.cancelTitle", { name: cancelTarget.student_name }) : ""}
        description={t("parent.cancelBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              {t("parent.keepWaiting")}
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancelling}>
              {t("parent.cancelCall")}
            </Button>
          </>
        }
      >
        <p className="pb-2 text-sm text-[var(--color-muted)]">{t("parent.hintIdle")}</p>
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RequestCard({
  row,
  now,
  timeZone,
  allowCancel,
  onCancel,
}: {
  row: DismissalQueueRow;
  now: number;
  timeZone: string;
  allowCancel: boolean;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const state = boardState(row);
  const cancellable = allowCancel && state === "called";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn("surface-card overflow-hidden p-4", state === "called" && "ring-2 ring-[var(--color-called-deep)]")}
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={row.student_name} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16.5px] font-bold tracking-[-0.015em]">{row.student_name}</h3>
          <p className="truncate text-[13px] text-[var(--color-muted)]">
            <span className="code font-semibold">{row.classroom_name}</span>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--color-called)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-called-ink)]">
          {t("parent.status.called")}
        </span>
      </div>

      <p className="mt-3 text-[13.5px] font-medium leading-snug">{t("parent.status.calledHint")}</p>

      <div className="mt-3">
        <StatusTracker status={row.status} />
      </div>

      <p className="tabular mt-3.5 text-[12.5px] text-[var(--color-muted)]">
        {t("parent.requestedAt", { time: formatTime(row.called_at ?? row.requested_at, timeZone, locale) })} · {timeAgo(row.requested_at, now, locale)}
      </p>

      {row.vehicle_description || row.note ? (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[var(--color-muted)]">
          {row.vehicle_description ? (
            <span className="inline-flex items-center gap-1.5">
              <Car className="size-3.5" />
              {row.vehicle_description}
            </span>
          ) : null}
          {row.note ? (
            <span className="inline-flex items-center gap-1.5">
              <MessageSquareText className="size-3.5" />
              {row.note}
            </span>
          ) : null}
        </div>
      ) : null}

      {cancellable ? (
        <button type="button" onClick={onCancel} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10">
          <X className="size-3.5" />
          {t("parent.cancelThis")}
        </button>
      ) : null}
    </motion.article>
  );
}
