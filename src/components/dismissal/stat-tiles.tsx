import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: number;
  tone: "amber" | "indigo" | "emerald" | "slate";
  hint?: string;
}

const TONES: Record<Stat["tone"], string> = {
  amber: "text-amber-600 dark:text-amber-400",
  indigo: "text-brand-700 dark:text-brand-300",
  emerald: "text-emerald-600 dark:text-emerald-400",
  slate: "text-[var(--color-muted)]",
};

const DOTS: Record<Stat["tone"], string> = {
  amber: "bg-amber-500",
  indigo: "bg-brand-600",
  emerald: "bg-emerald-500",
  slate: "bg-slate-400",
};

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="surface-card px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            <span className={cn("size-1.5 rounded-full", DOTS[stat.tone])} aria-hidden />
            {stat.label}
          </p>
          <p className={cn("tabular mt-1.5 text-3xl font-extrabold tracking-[-0.03em]", TONES[stat.tone])}>
            {stat.value}
          </p>
          {stat.hint ? (
            <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">{stat.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
