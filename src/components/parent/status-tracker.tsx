"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { LIFECYCLE, STATUS_META } from "@/lib/dismissal";
import { cn } from "@/lib/utils";
import type { DismissalStatus } from "@/lib/types/database";

const SHORT: Record<DismissalStatus, string> = {
  requested: "Sent",
  waiting: "Waiting",
  called: "Called",
  ready: "Ready",
  picked_up: "Done",
  cancelled: "Cancelled",
};

/**
 * The five-step journey a parent sees. The filled rail animates forward as the
 * request advances, which is what makes a Realtime update feel like progress
 * rather than a re-render.
 */
export function StatusTracker({ status }: { status: DismissalStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
        {STATUS_META.cancelled.parentHint}
      </div>
    );
  }

  const currentIndex = Math.max(0, LIFECYCLE.indexOf(status));
  const progress = (currentIndex / (LIFECYCLE.length - 1)) * 100;

  return (
    <div className="pt-1">
      <div className="relative">
        {/* Rail */}
        <div
          aria-hidden
          className="absolute left-[10px] right-[10px] top-[11px] h-[3px] rounded-full bg-black/[0.08] dark:bg-white/[0.12]"
        />
        <motion.div
          aria-hidden
          className="absolute left-[10px] top-[11px] h-[3px] rounded-full bg-brand-600"
          initial={false}
          animate={{ width: `calc((100% - 20px) * ${progress / 100})` }}
          transition={{ type: "spring", stiffness: 180, damping: 26 }}
        />

        <ol className="relative flex justify-between">
          {LIFECYCLE.map((step, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;

            return (
              <li key={step} className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "relative flex size-[22px] items-center justify-center rounded-full border-2 transition-colors",
                    done && "border-brand-600 bg-brand-600 text-white",
                    active && "border-brand-600 bg-[var(--color-surface)]",
                    !done && !active && "border-black/[0.12] bg-[var(--color-surface)] dark:border-white/[0.18]",
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3.5} /> : null}
                  {active ? (
                    <>
                      <span className="absolute inline-flex size-2.5 animate-[halo_2.2s_ease-out_infinite] rounded-full bg-brand-500" />
                      <span className="relative size-2.5 rounded-full bg-brand-600" />
                    </>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-[10.5px] font-semibold uppercase tracking-wide",
                    active
                      ? "text-brand-700 dark:text-brand-300"
                      : "text-[var(--color-muted)]",
                  )}
                >
                  {SHORT[step]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
