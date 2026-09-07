"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error("AGS Dismissal error:", error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
        <TriangleAlert className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em]">{t("error.title")}</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-muted)]">{t("error.body")}</p>
      {error.digest ? <p className="mt-3 font-mono text-[12px] text-[var(--color-muted)]">{error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="size-4" />
        {t("common.retry")}
      </Button>
    </main>
  );
}
