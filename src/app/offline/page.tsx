import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <LogoMark className="size-11" />
      <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
        <WifiOff className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em]">You&apos;re offline</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-muted)]">
        Dismissal updates are live, so AGS Dismissals needs a connection. Reconnect and this page
        will pick up right where it left off.
      </p>
      <p className="mt-6 rounded-xl bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-muted)] ring-1 ring-[var(--color-hairline)]">
        Already at the school? Let a staff member know you&apos;ve arrived and they can add your
        student to the queue.
      </p>
    </main>
  );
}
