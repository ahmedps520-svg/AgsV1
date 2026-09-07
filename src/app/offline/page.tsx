"use client";

import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { useI18n } from "@/lib/i18n/provider";

export default function OfflinePage() {
  const { t } = useI18n();
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-14" />
      <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
        <WifiOff className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em]">{t("offline.title")}</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-muted)]">{t("offline.body")}</p>
    </main>
  );
}
