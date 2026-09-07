"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure to whatever error reporting the host provides.
    console.error("Map Dismissals error:", error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
        <TriangleAlert className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em]">Something went wrong</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-muted)]">
        This screen failed to load. Dismissal itself is unaffected — try again, and let the school
        office know if it keeps happening.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[12px] text-[var(--color-muted)]">
          Reference: {error.digest}
        </p>
      ) : null}
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="size-4" />
        Try again
      </Button>
    </main>
  );
}
