"use client";

import { motion } from "framer-motion";
import {
  Car,
  Check,
  CornerUpLeft,
  Hash,
  Megaphone,
  MessageSquareText,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dismissal/status-badge";
import { describeSource, studentSubtitle } from "@/lib/dismissal";
import { cn, elapsed, formatTime, ordinal, timeAgo } from "@/lib/utils";
import type { DismissalQueueRow, DismissalStatus } from "@/lib/types/database";

export interface QueueCardProps {
  row: DismissalQueueRow;
  timeZone: string;
  now: number;
  showPickupNumber: boolean;
  pending: boolean;
  onSetStatus: (status: DismissalStatus) => void;
  onCancel: () => void;
}

/** The line of time information that matters in this state. */
function timing(row: DismissalQueueRow, timeZone: string, now: number) {
  switch (row.status) {
    case "called":
      return {
        icon: Megaphone,
        text: `Called at ${formatTime(row.called_at, timeZone)}`,
        detail: timeAgo(row.called_at, now),
        tone: "text-indigo-600 dark:text-indigo-400",
      };
    case "ready":
      return {
        icon: Check,
        text: `Ready at ${formatTime(row.ready_at, timeZone)}`,
        detail: timeAgo(row.ready_at, now),
        tone: "text-emerald-600 dark:text-emerald-400",
      };
    case "picked_up":
      return {
        icon: Check,
        text: `Picked up at ${formatTime(row.picked_up_at, timeZone)}`,
        detail: null,
        tone: "text-[var(--color-muted)]",
      };
    case "cancelled":
      return {
        icon: X,
        text: `Cancelled at ${formatTime(row.cancelled_at, timeZone)}`,
        detail: row.cancel_reason,
        tone: "text-rose-600 dark:text-rose-400",
      };
    default:
      return {
        icon: Timer,
        text: `Waiting ${elapsed(row.requested_at, now)}`,
        detail: `Arrived ${formatTime(row.requested_at, timeZone)}`,
        tone: "text-amber-600 dark:text-amber-400",
      };
  }
}

export function QueueCard({
  row,
  timeZone,
  now,
  showPickupNumber,
  pending,
  onSetStatus,
  onCancel,
}: QueueCardProps) {
  const info = timing(row, timeZone, now);
  const TimeIcon = info.icon;
  const isOpen = row.status !== "picked_up" && row.status !== "cancelled";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 460, damping: 38, mass: 0.6 }}
      className={cn(
        "surface-card relative overflow-hidden p-4 transition-shadow",
        pending && "opacity-70",
        row.status === "called" && "ring-1 ring-indigo-500/25",
        row.status === "ready" && "ring-1 ring-emerald-500/25",
      )}
    >
      {/* Status rail */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          row.status === "called" && "bg-indigo-500",
          row.status === "ready" && "bg-emerald-500",
          (row.status === "waiting" || row.status === "requested") && "bg-amber-400",
          row.status === "picked_up" && "bg-slate-300 dark:bg-slate-600",
          row.status === "cancelled" && "bg-rose-400",
        )}
      />

      <div className="flex items-start gap-3.5 pl-1.5">
        <Avatar name={row.student_name} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="truncate text-[16.5px] font-bold tracking-[-0.015em]">
              {row.student_name}
            </h3>
            {showPickupNumber && row.pickup_number ? (
              <span className="tabular inline-flex items-center gap-0.5 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[12px] font-bold text-[var(--color-ink)] dark:bg-white/[0.1]">
                <Hash className="size-3 opacity-60" />
                {row.pickup_number}
              </span>
            ) : null}
            {row.queue_position && (row.status === "waiting" || row.status === "requested") ? (
              <span className="tabular rounded-md bg-amber-100 px-1.5 py-0.5 text-[11.5px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {ordinal(row.queue_position)} in line
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-[13.5px] text-[var(--color-muted)]">
            {studentSubtitle(row) || "No class assigned"}
          </p>

          <div className={cn("tabular mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium", info.tone)}>
            <TimeIcon className="size-3.5 shrink-0" />
            <span>{info.text}</span>
            {info.detail ? (
              <span className="font-normal text-[var(--color-muted)]">· {info.detail}</span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Car className="size-3.5 shrink-0" />
              {describeSource(row)}
              {row.vehicle_description ? ` · ${row.vehicle_description}` : ""}
            </span>
            {row.note ? (
              <span className="inline-flex items-center gap-1.5">
                <MessageSquareText className="size-3.5 shrink-0" />
                {row.note}
              </span>
            ) : null}
          </div>
        </div>

        <StatusBadge status={row.status} className="hidden shrink-0 sm:inline-flex" />
      </div>

      {/* Actions */}
      <div className="mt-3.5 flex flex-wrap gap-2 pl-1.5">
        {(row.status === "requested" || row.status === "waiting") && (
          <Button size="sm" onClick={() => onSetStatus("called")} disabled={pending}>
            <Megaphone className="size-3.5" />
            Call student
          </Button>
        )}

        {row.status === "called" && (
          <>
            <Button size="sm" variant="success" onClick={() => onSetStatus("ready")} disabled={pending}>
              <Check className="size-3.5" />
              Mark ready
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onSetStatus("waiting")} disabled={pending}>
              <CornerUpLeft className="size-3.5" />
              Undo
            </Button>
          </>
        )}

        {row.status === "ready" && (
          <>
            <Button size="sm" variant="success" onClick={() => onSetStatus("picked_up")} disabled={pending}>
              <Check className="size-3.5" />
              Picked up
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onSetStatus("called")} disabled={pending}>
              <CornerUpLeft className="size-3.5" />
              Undo
            </Button>
          </>
        )}

        {row.status === "picked_up" && (
          <Button size="sm" variant="secondary" onClick={() => onSetStatus("ready")} disabled={pending}>
            <CornerUpLeft className="size-3.5" />
            Undo pickup
          </Button>
        )}

        {row.status === "cancelled" && (
          <Button size="sm" variant="secondary" onClick={() => onSetStatus("waiting")} disabled={pending}>
            <RotateCcw className="size-3.5" />
            Put back in the queue
          </Button>
        )}

        {isOpen ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
            onClick={onCancel}
            disabled={pending}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
        ) : null}
      </div>
    </motion.article>
  );
}
