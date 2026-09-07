"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCheck,
  ExternalLink,
  Megaphone,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorMessage } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useLiveQueue } from "@/hooks/use-live-queue";
import { useNow } from "@/hooks/use-now";
import { getQueue } from "@/lib/api/queries";
import { LANES, sortQueue } from "@/lib/dismissal";
import { cn, formatDate } from "@/lib/utils";
import {
  callNextAction,
  cancelRequestAction,
  endSessionAction,
  setStatusAction,
} from "@/lib/api/mutations";
import { QueueCard } from "@/components/dismissal/queue-card";
import { AddToQueueModal } from "@/components/dismissal/add-to-queue-modal";
import { ConnectionPill } from "@/components/dismissal/connection-pill";
import { StatTiles } from "@/components/dismissal/stat-tiles";
import type { DismissalQueueRow, DismissalStatus, SchoolRow } from "@/lib/types/database";
import type { StudentWithClassroom } from "@/lib/api/queries";

type LaneId = (typeof LANES)[number]["id"];

export function DismissalDashboard({
  school,
  initialQueue,
  students,
  today,
}: {
  school: SchoolRow;
  initialQueue: DismissalQueueRow[];
  students: StudentWithClassroom[];
  today: string;
}) {
  const toast = useToast();
  const now = useNow(1000);

  const load = React.useCallback(() => getQueue(school.id, today), [school.id, today]);

  const { rows, connection, refresh, error } = useLiveQueue<DismissalQueueRow>({
    channelName: `dismissal-dashboard:${school.id}`,
    filter: `school_id=eq.${school.id}`,
    initial: initialQueue,
    load,
  });

  const [term, setTerm] = React.useState("");
  const [showCancelled, setShowCancelled] = React.useState(false);
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = React.useState(false);
  const [cancelTarget, setCancelTarget] = React.useState<DismissalQueueRow | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [endOpen, setEndOpen] = React.useState(false);
  const [callingNext, setCallingNext] = React.useState(false);

  const setPending = React.useCallback((id: string, on: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /* ------------------------------------------------------------- filtering */

  const filtered = React.useMemo(() => {
    const needle = term.trim().toLowerCase();
    return rows.filter((row) => {
      if (!showCancelled && row.status === "cancelled") return false;
      if (!needle) return true;

      const haystack = [
        row.student_name,
        row.student_grade,
        row.classroom_name,
        row.pickup_number,
        row.guardian_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [rows, term, showCancelled]);

  const lanes = React.useMemo(() => {
    const grouped = new Map<LaneId, DismissalQueueRow[]>();
    for (const lane of LANES) grouped.set(lane.id, []);

    for (const row of sortQueue(filtered)) {
      const lane = LANES.find((candidate) => candidate.statuses.includes(row.status));
      if (lane) grouped.get(lane.id)!.push(row);
    }
    return grouped;
  }, [filtered]);

  const cancelledRows = React.useMemo(
    () => (showCancelled ? sortQueue(filtered.filter((row) => row.status === "cancelled")) : []),
    [filtered, showCancelled],
  );

  const counts = React.useMemo(() => {
    const base = { queued: 0, called: 0, ready: 0, picked_up: 0 };
    for (const row of rows) {
      if (row.status === "requested" || row.status === "waiting") base.queued += 1;
      else if (row.status === "called") base.called += 1;
      else if (row.status === "ready") base.ready += 1;
      else if (row.status === "picked_up") base.picked_up += 1;
    }
    return base;
  }, [rows]);

  const activeStudentIds = React.useMemo(
    () =>
      new Set(
        rows
          .filter((row) => row.status !== "picked_up" && row.status !== "cancelled")
          .map((row) => row.student_id),
      ),
    [rows],
  );

  /* --------------------------------------------------------------- actions */

  async function changeStatus(row: DismissalQueueRow, status: DismissalStatus) {
    setPending(row.id, true);
    const result = await setStatusAction({ requestId: row.id, status });
    setPending(row.id, false);

    if (!result.ok) {
      toast.error("That didn't work", result.error);
      void refresh();
      return;
    }

    if (status === "called") toast.success(`${row.student_name} called`, "The board is updating now.");
    if (status === "ready") toast.success(`${row.student_name} is ready`);
    if (status === "picked_up") toast.success(`${row.student_name} picked up`);
    if (status === "waiting") toast.success(`${row.student_name} is back in the queue`);
    void refresh();
  }

  async function callNext() {
    setCallingNext(true);
    const result = await callNextAction();
    setCallingNext(false);

    if (!result.ok) {
      toast.error("Couldn't call the next student", result.error);
      return;
    }
    if (!result.data) {
      toast.toast({ tone: "info", title: "Nobody is waiting", description: "The queue is empty." });
      return;
    }

    toast.success(`${result.data.student_name} called`, "Now showing on the dismissal board.");
    void refresh();
  }

  async function confirmCancel() {
    if (!cancelTarget) return;

    const target = cancelTarget;
    setPending(target.id, true);
    const result = await cancelRequestAction({ requestId: target.id, reason: cancelReason });
    setPending(target.id, false);
    setCancelTarget(null);
    setCancelReason("");

    if (!result.ok) {
      toast.error("Couldn't cancel", result.error);
      return;
    }

    toast.success(`${target.student_name} removed from the queue`);
    void refresh();
  }

  async function confirmEndSession() {
    setEndOpen(false);
    const result = await endSessionAction();

    if (!result.ok) {
      toast.error("Couldn't close dismissal", result.error);
      return;
    }

    toast.success(
      result.data === 0 ? "Dismissal was already clear" : `Cleared ${result.data} open request${result.data === 1 ? "" : "s"}`,
    );
    void refresh();
  }

  /* ----------------------------------------------------------------- view */

  const nothingToday = rows.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">Dismissal</h1>
            <ConnectionPill state={connection} />
          </div>
          <p className="mt-1 text-[14px] text-[var(--color-muted)]">
            {formatDate(new Date(), school.timezone)}
            {school.dismissal_start && school.dismissal_end
              ? ` · ${school.dismissal_start.slice(0, 5)}–${school.dismissal_end.slice(0, 5)}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="md" onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" />
            Add student
          </Button>
          <Button size="md" onClick={callNext} loading={callingNext} disabled={counts.queued === 0}>
            <Megaphone className="size-4" />
            Call next
            {counts.queued > 0 ? (
              <span className="tabular ml-0.5 rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-bold">
                {counts.queued}
              </span>
            ) : null}
          </Button>
        </div>
      </header>

      {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

      {/* Stats */}
      <div className="mt-5">
        <StatTiles
          stats={[
            { label: "Arrived", value: counts.queued, tone: "amber", hint: "Waiting to be called" },
            { label: "Called", value: counts.called, tone: "indigo", hint: "On the board now" },
            { label: "Ready", value: counts.ready, tone: "emerald", hint: "At the pickup point" },
            { label: "Picked up", value: counts.picked_up, tone: "slate", hint: "Completed today" },
          ]}
        />
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search name, grade, class, pickup number…"
            aria-label="Search the dismissal queue"
            className="pl-10 pr-9"
          />
          {term ? (
            <button
              type="button"
              onClick={() => setTerm("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--color-muted)] transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <Button
          variant={showCancelled ? "primary" : "secondary"}
          size="md"
          onClick={() => setShowCancelled((value) => !value)}
        >
          <SlidersHorizontal className="size-4" />
          {showCancelled ? "Hide cancelled" : "Show cancelled"}
        </Button>

        <Link
          href="/board"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-surface)] px-4 text-sm font-medium shadow-soft ring-1 ring-inset ring-[var(--color-hairline)] transition hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
        >
          <ExternalLink className="size-4" />
          Open board
        </Link>

        <Button
          variant="ghost"
          size="md"
          className="ml-auto"
          onClick={() => setEndOpen(true)}
          disabled={counts.queued + counts.called + counts.ready === 0}
        >
          <CheckCheck className="size-4" />
          End dismissal
        </Button>
      </div>

      {/* Lanes */}
      {nothingToday ? (
        <EmptyState
          className="mt-8"
          icon={Sparkles}
          title="Dismissal hasn't started yet"
          description="When a parent taps “I'm Here”, their request lands here instantly. You can also add a student yourself."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className="size-4" />
              Add the first student
            </Button>
          }
        />
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 min-[1600px]:grid-cols-4">
          {LANES.map((lane) => {
            const laneRows = lanes.get(lane.id) ?? [];
            return (
              <section key={lane.id} className="min-w-0" aria-label={lane.title}>
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    {lane.title}
                  </h2>
                  <span className="tabular rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[12px] font-bold text-[var(--color-muted)] dark:bg-white/[0.08]">
                    {laneRows.length}
                  </span>
                </div>

                <div className="space-y-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {laneRows.map((row) => (
                      <QueueCard
                        key={row.id}
                        row={row}
                        now={now}
                        timeZone={school.timezone}
                        showPickupNumber={school.show_pickup_number}
                        pending={pendingIds.has(row.id)}
                        onSetStatus={(status) => changeStatus(row, status)}
                        onCancel={() => {
                          setCancelTarget(row);
                          setCancelReason("");
                        }}
                      />
                    ))}
                  </AnimatePresence>

                  {laneRows.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[var(--color-hairline)] px-4 py-7 text-center text-[13px] text-[var(--color-muted)]">
                      {lane.id === "queued"
                        ? "No one is waiting"
                        : lane.id === "called"
                          ? "Nobody called yet"
                          : lane.id === "ready"
                            ? "No students at the door"
                            : "No pickups completed"}
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Cancelled */}
      {showCancelled && cancelledRows.length > 0 ? (
        <section className="mt-8" aria-label="Cancelled">
          <h2 className="mb-2.5 px-1 text-[13px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Cancelled today
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 min-[1600px]:grid-cols-4">
            <AnimatePresence initial={false}>
              {cancelledRows.map((row) => (
                <motion.div key={row.id} layout="position">
                  <QueueCard
                    row={row}
                    now={now}
                    timeZone={school.timezone}
                    showPickupNumber={school.show_pickup_number}
                    pending={pendingIds.has(row.id)}
                    onSetStatus={(status) => changeStatus(row, status)}
                    onCancel={() => undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      ) : null}

      {/* Modals */}
      <AddToQueueModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        students={students}
        activeStudentIds={activeStudentIds}
        showPickupNumber={school.show_pickup_number}
        onAdded={() => void refresh()}
      />

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={cancelTarget ? `Cancel pickup for ${cancelTarget.student_name}?` : "Cancel pickup"}
        description="The request leaves the queue. The parent sees the change immediately."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Keep in queue
            </Button>
            <Button variant="danger" onClick={confirmCancel}>
              Cancel pickup
            </Button>
          </>
        }
      >
        <Textarea
          data-autofocus
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Reason (optional) — e.g. going home on the bus today"
          maxLength={200}
          className="mb-2"
        />
      </Modal>

      <Modal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="End today's dismissal?"
        description={`${counts.queued + counts.called + counts.ready} open request${
          counts.queued + counts.called + counts.ready === 1 ? "" : "s"
        } will be cleared from the queue. Completed pickups stay in your history.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndOpen(false)}>
              Not yet
            </Button>
            <Button variant="danger" onClick={confirmEndSession}>
              <CheckCheck className="size-4" />
              End dismissal
            </Button>
          </>
        }
      >
        <p className={cn("pb-2 text-sm text-[var(--color-muted)]")}>
          Use this at the end of the pickup window so tomorrow starts clean.
        </p>
      </Modal>
    </div>
  );
}
