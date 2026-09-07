"use client";

import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate, formatTime } from "@/lib/utils";

export function BoardClock({ timeZone }: { timeZone: string }) {
  const now = useNow(1000);
  const { locale } = useI18n();
  const date = new Date(now);

  return (
    <div className="text-end">
      <p
        dir="ltr"
        className="tabular text-[clamp(1.75rem,3.4vw,3.5rem)] font-bold leading-none tracking-[-0.03em]"
        suppressHydrationWarning
      >
        {formatTime(date, timeZone, locale)}
      </p>
      <p
        className="mt-1.5 text-[clamp(0.8rem,1.1vw,1.15rem)] font-medium text-[var(--board-muted)]"
        suppressHydrationWarning
      >
        {formatDate(date, timeZone, locale)}
      </p>
    </div>
  );
}
