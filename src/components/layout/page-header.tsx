import * as React from "react";
import { BackLink } from "@/components/layout/back-link";

export function PageHeader({
  title,
  description,
  action,
  /** Where "back" goes. Every admin screen hangs off the class boards. */
  backHref = "/board/",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string | null;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {backHref ? (
          <BackLink href={backHref} labelKey="common.backToBoards" className="-ms-2 mb-1.5" />
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-5 sm:px-6 lg:px-8 lg:pt-8">{children}</div>
  );
}
