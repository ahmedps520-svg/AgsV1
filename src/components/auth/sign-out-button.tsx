"use client";

import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Posts to a route handler rather than calling a server action, so signing out
 * works even if client JavaScript has not hydrated.
 */
export function SignOutButton({
  className,
  label = "Sign out",
  compact = false,
}: {
  className?: string;
  label?: string;
  compact?: boolean;
}) {
  return (
    <form action="/auth/sign-out" method="post">
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl text-sm font-medium transition",
          compact
            ? "w-full px-3 py-2 text-[var(--color-muted)] hover:bg-black/[0.05] hover:text-[var(--color-ink)] dark:hover:bg-white/[0.07]"
            : "bg-[var(--color-surface)] px-4 py-2.5 text-[var(--color-ink)] shadow-soft ring-1 ring-[var(--color-hairline)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
          className,
        )}
      >
        <LogOut className="size-4 shrink-0" />
        {label}
      </button>
    </form>
  );
}
