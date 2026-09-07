"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Car,
  CircleUser,
  Hand,
  Hash,
  Info,
  MessageSquareText,
  ShieldAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { Avatar, EmptyState, ErrorMessage, LiveDot } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useLiveQueue } from "@/hooks/use-live-queue";
import { useNow } from "@/hooks/use-now";
import { fetchGuardianRequests } from "@/lib/live-queries";
import { cancelRequestAction } from "@/server/actions/dismissal";
import { STATUS_META, isActive } from "@/lib/dismissal";
import { cn, formatTime, ordinal, timeAgo } from "@/lib/utils";
import { StatusTracker } from "@/components/parent/status-tracker";
import { ArriveSheet } from "@/components/parent/arrive-sheet";
import { InstallHint } from "@/components/parent/install-hint";
import { LogoMark } from "@/components/logo";
import type { DismissalQueueRow, SchoolRow } from "@/lib/types/database";
import type { GuardianStudent } from "@/server/queries/dismissal";

function greeting(date: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(date),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function ParentApp({
  school,
  guardianName,
  defaultVehicle,
  students,
  initialRequests,
  autoOpenArrive,
}: {
  school: Pick<SchoolRow, "id" | "name" | "timezone" | "show_queue_position" | "show_pickup_number" | "allow_parent_cancel" | "board_message"> | null;
  guardianName: string;
  defaultVehicle: string | null;
  students: GuardianStudent[];
  initialRequests: DismissalQueueRow[];
  autoOpenArrive: boolean;
}) {
  const toast = useToast();
  const now = useNow(1000);
  const timeZone = school?.timezone ?? "UTC";

  const studentIds = React.useMemo(
    () => students.map((link) => link.student?.id).filter((id): id is string => Boolean(id)),
    [students],
  );

  const load = React.useCallback(() => fetchGuardianRequests(studentIds), [studentIds]);

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
    () =>
      rows
        .filter((row) => isActive(row.status))
        .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()),
    [rows],
  );

  const finishedToday = React.useMemo(() => {
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return rows
      .filter((row) => !isActive(row.status) && row.dismissal_date === todayKey)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [rows, timeZone]);

  const activeStudentIds = React.useMemo(
    () => new Set(active.map((row) => row.student_id)),
    [active],
  );

  const pickupReady = active.some((row) => row.status === "ready");

  async function confirmCancel() {
    if (!cancelTarget) return;

    setCancelling(true);
    const result = await cancelRequestAction({ requestId: cancelTarget.id });
    setCancelling(false);

    if (!result.ok) {
      toast.error("Couldn't cancel", result.error);
      setCancelTarget(null);
      return;
    }

    toast.success("Pickup cancelled", "The school has been notified.");
    setCancelTarget(null);
    void refresh();
  }

  const canArrive = students.some(
    (link) => link.can_pickup && link.student && !activeStudentIds.has(link.student.id),
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-canvas)]">
      {/* -------------------------------------------------------- app header */}
      <header className="glass sticky top-0 z-30 border-b border-[var(--color-hairline)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3">
          <LogoMark className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.02em]">
              {school?.name ?? "Map Dismissals"}
            </p>
            <p className="flex items-center gap-1.5 truncate text-[12px] text-[var(--color-muted)]">
              <LiveDot connected={connection === "live"} />
              {connection === "live" ? "Live updates on" : "Reconnecting…"}
            </p>
          </div>
          <Link
            href="/account"
            aria-label="Your account"
            className="rounded-xl p-2 text-[var(--color-muted)] transition hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10"
          >
            <CircleUser className="size-6" />
          </Link>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-lg flex-1 px-4 pb-40 pt-5"
      >
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em]">
          {greeting(new Date(now), timeZone)},{" "}
          {guardianName.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--color-muted)]">
          {active.length > 0
            ? "We'll keep this updated as your student moves through pickup."
            : "Tap “I'm Here” when you arrive at the school."}
        </p>

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        {/* ------------------------------------------------- active requests */}
        <AnimatePresence initial={false}>
          {active.length > 0 ? (
            <motion.section
              key="active"
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6"
              aria-label="Today's pickups"
            >
              <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                In progress
              </h2>

              <div className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {active.map((row) => (
                    <RequestCard
                      key={row.id}
                      row={row}
                      now={now}
                      timeZone={timeZone}
                      showQueuePosition={school?.show_queue_position ?? true}
                      showPickupNumber={school?.show_pickup_number ?? true}
                      allowCancel={school?.allow_parent_cancel ?? true}
                      onCancel={() => setCancelTarget(row)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* -------------------------------------------------- your students */}
        <section className="mt-7" aria-label="Your students">
          <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Your students
          </h2>

          {students.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No students linked yet"
              description="Your school hasn't linked any students to this account. Contact the school office and they'll add them."
            />
          ) : (
            <ul className="space-y-2.5">
              {students.map((link) => {
                const student = link.student!;
                const name = `${student.first_name} ${student.last_name}`.trim();
                const current = active.find((row) => row.student_id === student.id);

                return (
                  <li key={link.id} className="surface-card flex items-center gap-3.5 p-3.5">
                    <Avatar name={name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15.5px] font-bold tracking-[-0.01em]">{name}</p>
                      <p className="truncate text-[13px] text-[var(--color-muted)]">
                        {[student.grade, student.classroom?.name ? `Class ${student.classroom.name}` : null]
                          .filter(Boolean)
                          .join(" — ") || "No class assigned"}
                        {link.relationship ? ` · ${link.relationship}` : ""}
                      </p>
                    </div>

                    {current ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide ring-1 ring-inset",
                          STATUS_META[current.status].soft,
                        )}
                      >
                        {STATUS_META[current.status].parentLabel}
                      </span>
                    ) : !link.can_pickup ? (
                      <span className="shrink-0 rounded-full bg-black/[0.06] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-muted)] dark:bg-white/[0.08]">
                        Not authorised
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* --------------------------------------------------- earlier today */}
        {finishedToday.length > 0 ? (
          <section className="mt-7" aria-label="Earlier today">
            <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Earlier today
            </h2>
            <ul className="space-y-2">
              {finishedToday.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-xl bg-[var(--color-surface)] px-3.5 py-3 ring-1 ring-[var(--color-hairline)]"
                >
                  <CalendarClock className="size-4 shrink-0 text-[var(--color-muted)]" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                    {row.student_name}
                  </span>
                  <span className="shrink-0 text-[12.5px] text-[var(--color-muted)]">
                    {STATUS_META[row.status].parentLabel}
                    {row.picked_up_at ? ` · ${formatTime(row.picked_up_at, timeZone)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {school?.board_message ? (
          <p className="mt-7 flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5 text-[13px] leading-relaxed text-brand-900 ring-1 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-400/20">
            <Info className="mt-0.5 size-4 shrink-0" />
            {school.board_message}
          </p>
        ) : null}

        <InstallHint />
      </main>

      {/* ----------------------------------------------------- sticky action */}
      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-hairline)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto w-full max-w-lg">
          {pickupReady ? (
            <p className="mb-2.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-[13.5px] font-semibold text-white">
              Your student is at the pickup point
            </p>
          ) : null}

          <Button
            size="xl"
            className="w-full"
            onClick={() => setArriveOpen(true)}
            disabled={!canArrive || students.length === 0}
          >
            <Hand className="size-5" />
            {students.length === 0
              ? "No students linked"
              : canArrive
                ? "I'm Here"
                : "All students requested"}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------ modals */}
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
        title={cancelTarget ? `Cancel pickup for ${cancelTarget.student_name}?` : "Cancel pickup"}
        description="The school will be told you're no longer waiting."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Keep waiting
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancelling}>
              Cancel pickup
            </Button>
          </>
        }
      >
        <p className="pb-2 text-sm text-[var(--color-muted)]">
          You can tap <span className="font-semibold text-[var(--color-ink)]">I&apos;m Here</span>{" "}
          again at any time.
        </p>
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RequestCard({
  row,
  now,
  timeZone,
  showQueuePosition,
  showPickupNumber,
  allowCancel,
  onCancel,
}: {
  row: DismissalQueueRow;
  now: number;
  timeZone: string;
  showQueuePosition: boolean;
  showPickupNumber: boolean;
  allowCancel: boolean;
  onCancel: () => void;
}) {
  const meta = STATUS_META[row.status];
  const cancellable = allowCancel && (row.status === "requested" || row.status === "waiting");

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn(
        "surface-card overflow-hidden p-4",
        row.status === "ready" && "ring-2 ring-emerald-500/40",
        row.status === "called" && "ring-2 ring-brand-500/35",
      )}
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={row.student_name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[16.5px] font-bold tracking-[-0.015em]">
              {row.student_name}
            </h3>
            {showPickupNumber && row.pickup_number ? (
              <span className="tabular inline-flex items-center gap-0.5 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[12px] font-bold dark:bg-white/[0.1]">
                <Hash className="size-3 opacity-60" />
                {row.pickup_number}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[13px] text-[var(--color-muted)]">
            {[row.student_grade, row.classroom_name ? `Class ${row.classroom_name}` : null]
              .filter(Boolean)
              .join(" — ")}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide ring-1 ring-inset",
            meta.soft,
          )}
        >
          {meta.parentLabel}
        </span>
      </div>

      <p className="mt-3 text-[13.5px] font-medium leading-snug">{meta.parentHint}</p>

      <div className="mt-3">
        <StatusTracker status={row.status} />
      </div>

      <dl className="tabular mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[var(--color-muted)]">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Requested</dt>
          <dd>Requested {formatTime(row.requested_at, timeZone)} · {timeAgo(row.requested_at, now)}</dd>
        </div>

        {row.called_at ? (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Called</dt>
            <dd className="font-semibold text-brand-700 dark:text-brand-300">
              Called {formatTime(row.called_at, timeZone)}
            </dd>
          </div>
        ) : null}

        {showQueuePosition && row.queue_position ? (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Position</dt>
            <dd className="rounded-md bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {ordinal(row.queue_position)} of {row.queue_length} in line
            </dd>
          </div>
        ) : null}
      </dl>

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
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
        >
          <X className="size-3.5" />
          Cancel this pickup
        </button>
      ) : null}
    </motion.article>
  );
}
