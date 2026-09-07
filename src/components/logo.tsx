import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 512 512" className="size-5" fill="none">
        <path
          d="M256 92c-79 0-143 62-143 139 0 100 122 197 137 209a10 10 0 0 0 12 0c15-12 137-109 137-209 0-77-64-139-143-139z"
          fill="currentColor"
        />
        <circle cx="256" cy="228" r="56" fill="#4F3FD6" />
      </svg>
    </span>
  );
}

export function Logo({
  schoolName,
  className,
}: {
  schoolName?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold leading-tight tracking-[-0.02em]">
          {schoolName || "Map Dismissals"}
        </span>
        {schoolName ? (
          <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Map Dismissals
          </span>
        ) : null}
      </span>
    </span>
  );
}
