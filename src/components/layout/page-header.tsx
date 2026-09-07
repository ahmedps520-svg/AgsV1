import * as React from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
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
