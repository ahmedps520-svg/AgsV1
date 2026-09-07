import { cn } from "@/lib/utils";
import { LiveDot } from "@/components/ui/primitives";
import type { ConnectionState } from "@/hooks/use-live-queue";

const LABELS: Record<ConnectionState, string> = {
  live: "Live",
  connecting: "Connecting",
  offline: "Reconnecting",
};

export function ConnectionPill({
  state,
  className,
}: {
  state: ConnectionState;
  className?: string;
}) {
  return (
    <span
      title={
        state === "live"
          ? "Connected — changes appear instantly on every device."
          : "Trying to reconnect. The queue still refreshes every 30 seconds."
      }
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px] font-semibold",
        state === "live"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
        className,
      )}
    >
      <LiveDot connected={state === "live"} />
      {LABELS[state]}
    </span>
  );
}
