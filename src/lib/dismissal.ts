import type { DismissalQueueRow, DismissalStatus } from "@/lib/types/database";

/** The order a request travels through the board. */
export const LIFECYCLE: DismissalStatus[] = [
  "requested",
  "waiting",
  "called",
  "ready",
  "picked_up",
];

export interface StatusMeta {
  /** Wording staff see. */
  label: string;
  /** Wording parents see — friendlier, first person. */
  parentLabel: string;
  parentHint: string;
  /** Tailwind classes for a solid pill. */
  pill: string;
  /** Tailwind classes for a soft, tinted surface. */
  soft: string;
  /** Bare colour token used for dots, rails and the board. */
  dot: string;
  accent: string;
}

export const STATUS_META: Record<DismissalStatus, StatusMeta> = {
  requested: {
    label: "Request sent",
    parentLabel: "Request sent",
    parentHint: "The school has received your arrival.",
    pill: "bg-sky-600 text-white",
    soft: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20",
    dot: "bg-sky-500",
    accent: "sky",
  },
  waiting: {
    label: "Waiting",
    parentLabel: "Waiting",
    parentHint: "You're in the queue. We'll call your student shortly.",
    pill: "bg-amber-500 text-white",
    soft: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
    dot: "bg-amber-500",
    accent: "amber",
  },
  called: {
    label: "Called",
    parentLabel: "Called",
    parentHint: "Your student's name is on the board and they're on their way.",
    pill: "bg-indigo-600 text-white",
    soft: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20",
    dot: "bg-indigo-500",
    accent: "indigo",
  },
  ready: {
    label: "Ready",
    parentLabel: "Ready for pickup",
    parentHint: "Your student is at the pickup point.",
    pill: "bg-emerald-600 text-white",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    dot: "bg-emerald-500",
    accent: "emerald",
  },
  picked_up: {
    label: "Picked up",
    parentLabel: "Picked up",
    parentHint: "All done — have a great afternoon.",
    pill: "bg-slate-700 text-white",
    soft: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20",
    dot: "bg-slate-500",
    accent: "slate",
  },
  cancelled: {
    label: "Cancelled",
    parentLabel: "Cancelled",
    parentHint: "This pickup request was cancelled.",
    pill: "bg-rose-600 text-white",
    soft: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
    dot: "bg-rose-500",
    accent: "rose",
  },
};

export const ACTIVE_STATUSES: DismissalStatus[] = ["requested", "waiting", "called", "ready"];

export function isActive(status: DismissalStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Statuses shown in the "in the queue" lanes of the staff dashboard. */
export const LANES: { id: DismissalStatus | "queued"; title: string; statuses: DismissalStatus[] }[] = [
  { id: "queued", title: "Arrived", statuses: ["requested", "waiting"] },
  { id: "called", title: "Called", statuses: ["called"] },
  { id: "ready", title: "Ready", statuses: ["ready"] },
  { id: "picked_up", title: "Picked up", statuses: ["picked_up"] },
];

/** The timestamp that matters for a request in its current state. */
export function statusTimestamp(request: {
  status: DismissalStatus;
  requested_at: string;
  called_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  cancelled_at: string | null;
}): string {
  switch (request.status) {
    case "called":
      return request.called_at ?? request.requested_at;
    case "ready":
      return request.ready_at ?? request.called_at ?? request.requested_at;
    case "picked_up":
      return request.picked_up_at ?? request.requested_at;
    case "cancelled":
      return request.cancelled_at ?? request.requested_at;
    default:
      return request.requested_at;
  }
}

/** Sort so the most urgent work sits at the top of every lane. */
export function sortQueue(rows: DismissalQueueRow[]): DismissalQueueRow[] {
  return [...rows].sort((a, b) => {
    if (a.status === b.status) {
      // Called/ready students are sorted newest-first (they are being served);
      // waiting students oldest-first (first come, first served).
      const aTime = new Date(statusTimestamp(a)).getTime();
      const bTime = new Date(statusTimestamp(b)).getTime();
      return a.status === "called" || a.status === "ready" || a.status === "picked_up"
        ? bTime - aTime
        : aTime - bTime;
    }
    return LIFECYCLE.indexOf(a.status) - LIFECYCLE.indexOf(b.status);
  });
}

export function describeSource(row: {
  source: string;
  guardian_name: string | null;
  vehicle_description: string | null;
}): string {
  if (row.source === "parent_app") {
    return row.guardian_name ? `${row.guardian_name} is here` : "Parent is here";
  }
  if (row.source === "kiosk") return "Added at the kiosk";
  return row.guardian_name ? `Added by ${row.guardian_name}` : "Added by staff";
}

export function studentSubtitle(row: {
  student_grade: string | null;
  classroom_name: string | null;
}): string {
  return [row.student_grade, row.classroom_name ? `Class ${row.classroom_name}` : null]
    .filter(Boolean)
    .join(" — ");
}
