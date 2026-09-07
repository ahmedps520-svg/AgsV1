"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { boardState } from "@/lib/dismissal";
import { cn } from "@/lib/utils";
import type { DismissalStatus } from "@/lib/types/database";

/**
 * What a parent sees: their call is immediate (yellow on the class board),
 * then the teacher marks the child dismissed. Two steps, one rail.
 */
export function StatusTracker({ status }: { status: DismissalStatus }) {
  const { t } = useI18n();

  if (status === "cancelled") {
    return (
      <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
        {t("parent.status.cancelledHint")}
      </div>
    );
  }

  const state = boardState({ status });
  const steps = [
    { key: "called", label: t("parent.status.called"), done: true, active: state === "called" },
    { key: "dismissed", label: t("parent.status.dismissed"), done: state === "dismissed", active: state === "dismissed" },
  ];
  const progress = state === "dismissed" ? 100 : 0;

  return (
    <div className="pt-1">
      <div className="relative">
        <div aria-hidden className="absolute start-[10px] end-[10px] top-[11px] h-[3px] rounded-full bg-black/[0.08] dark:bg-white/[0.12]" />
        <motion.div
          aria-hidden
          className="absolute start-[10px] top-[11px] h-[3px] rounded-full bg-brand-600"
          initial={false}
          animate={{ width: `calc((100% - 20px) * ${progress / 100})` }}
          transition={{ type: "spring", stiffness: 180, damping: 26 }}
        />
        <ol className="relative flex justify-between">
          {steps.map((step) => (
            <li key={step.key} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "relative flex size-[22px] items-center justify-center rounded-full border-2 transition-colors",
                  step.done && !step.active && "border-brand-600 bg-brand-600 text-white",
                  step.active && "border-brand-600 bg-[var(--color-surface)]",
                  !step.done && !step.active && "border-black/[0.12] bg-[var(--color-surface)] dark:border-white/[0.18]",
                )}
              >
                {step.done && !step.active ? <Check className="size-3" strokeWidth={3.5} /> : null}
                {step.active ? (
                  <>
                    <span className="absolute inline-flex size-2.5 animate-[halo_2.2s_ease-out_infinite] rounded-full bg-brand-500" />
                    <span className="relative size-2.5 rounded-full bg-brand-600" />
                  </>
                ) : null}
              </span>
              <span className={cn("text-[10.5px] font-semibold uppercase tracking-wide", step.active ? "text-brand-700 dark:text-brand-300" : "text-[var(--color-muted)]")}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
