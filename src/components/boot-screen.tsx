import { LogoMark } from "@/components/logo";

/** Shown while the session is being resolved, before we know where to route. */
export function BootScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5">
      <LogoMark className="size-16 animate-[shimmer_1.6s_ease-in-out_infinite]" />
      <p className="text-sm font-medium text-[var(--color-muted)]">{label}</p>
    </div>
  );
}
