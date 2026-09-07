import * as React from "react";
import { cn, hashToIndex, initials } from "@/lib/utils";

/* ------------------------------------------------------------------ Card -- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pb-4 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge -- */

export function Badge({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Avatar -- */

const AVATAR_TONES = [
  "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const tone = AVATAR_TONES[hashToIndex(name || "?", AVATAR_TONES.length)];
  const sizes = {
    xs: "size-7 text-[10px]",
    sm: "size-9 text-xs",
    md: "size-11 text-sm",
    lg: "size-14 text-base",
    xl: "size-20 text-2xl",
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold tracking-tight",
        sizes[size],
        tone,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/* -------------------------------------------------------------- Skeleton -- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-[shimmer_1.6s_ease-in-out_infinite] rounded-lg bg-black/[0.07] dark:bg-white/[0.09]",
        className,
      )}
    />
  );
}

export function QueueSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading dismissal queue">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="surface-card flex items-center gap-4 p-4">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState -- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-hairline)] px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-black/[0.04] text-[var(--color-muted)] dark:bg-white/[0.06]">
          <Icon className="size-6" />
        </span>
      ) : null}
      <p className="text-[15px] font-semibold text-[var(--color-ink)]">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------- ErrorMessage -- */

export function ErrorMessage({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------ LiveDot ----- */

export function LiveDot({ connected, className }: { connected: boolean; className?: string }) {
  return (
    <span className={cn("relative flex size-2", className)} aria-hidden>
      {connected ? (
        <span className="absolute inline-flex size-2 animate-[halo_2.6s_ease-out_infinite] rounded-full bg-emerald-500" />
      ) : null}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          connected ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
    </span>
  );
}
