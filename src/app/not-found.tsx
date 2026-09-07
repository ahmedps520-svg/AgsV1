"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { useI18n } from "@/lib/i18n/provider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-14" />
      <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Compass className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em]">{t("notFound.title")}</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-muted)]">{t("notFound.body")}</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700">
        {t("notFound.back")}
      </Link>
    </main>
  );
}
