"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, DoorOpen, GraduationCap, Hand, ShieldCheck, Sparkles } from "lucide-react";
import { homePathForRole, useSession } from "@/lib/api/session";
import { IS_DEMO } from "@/lib/api/config";
import { useI18n } from "@/lib/i18n/provider";
import { BRAND } from "@/lib/brand";
import { Logo, LogoArabic } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { BootScreen } from "@/components/boot-screen";

export default function HomePage() {
  const { session, status } = useSession();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace(homePathForRole(session.profile.role));
  }, [session, router]);

  // Only signed-in visitors wait — they are about to be redirected.
  if (session) return <BootScreen />;

  const features = [
    { icon: Hand, title: t("landing.feature.parents.title"), body: t("landing.feature.parents.body") },
    { icon: DoorOpen, title: t("landing.feature.teachers.title"), body: t("landing.feature.teachers.body") },
    { icon: GraduationCap, title: t("landing.feature.classes.title"), body: t("landing.feature.classes.body") },
    { icon: ShieldCheck, title: t("landing.feature.security.title"), body: t("landing.feature.security.body") },
  ];

  return (
    <main id="main" className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_10%_-10%,var(--color-brand-100)_0%,transparent_55%),radial-gradient(80%_60%_at_92%_2%,var(--color-gold-100)_0%,transparent_60%)] dark:bg-[radial-gradient(120%_80%_at_10%_-10%,rgba(30,58,115,0.35)_0%,transparent_55%),radial-gradient(80%_60%_at_92%_2%,rgba(245,179,36,0.12)_0%,transparent_60%)]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
          >
            {t("common.signIn")}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-10 sm:pt-14">
        {IS_DEMO ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-gold-100 px-3 py-1.5 text-[13px] font-semibold text-gold-800 ring-1 ring-gold-600/20 dark:bg-gold-500/15 dark:text-gold-200 dark:ring-gold-400/25">
            <Sparkles className="size-3.5" />
            {t("app.demoBadge")}
          </p>
        ) : null}

        <h1 className="mt-6 max-w-3xl text-balance text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
          {t("landing.headline")}
        </h1>

        <p className="mt-3 text-xl font-semibold text-brand-700 dark:text-brand-300">{BRAND.name}</p>
        <LogoArabic className="mt-1 text-lg text-[var(--color-muted)]" />

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)] sm:text-xl">
          {t("landing.lede")}
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lift transition hover:bg-brand-700 active:scale-[0.99]"
          >
            {t(IS_DEMO ? "landing.cta.demo" : "landing.cta.signIn")}
            <ArrowRight className="size-5 rtl:rotate-180" />
          </Link>
          <Link
            href="/board/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-surface)] px-7 py-3.5 text-base font-semibold text-[var(--color-ink)] shadow-soft ring-1 ring-[var(--color-hairline)] transition hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
          >
            <GraduationCap className="size-5" />
            {t("landing.cta.board")}
          </Link>
        </div>

        <dl className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="surface-card p-5">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <Icon className="size-5" />
              </span>
              <dt className="mt-4 text-[15px] font-semibold tracking-tight">{title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{body}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex items-start gap-3 rounded-2xl bg-[var(--color-surface)] p-4 text-sm leading-relaxed text-[var(--color-muted)] ring-1 ring-[var(--color-hairline)]">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-gold-600" />
          <p>{t(IS_DEMO ? "landing.demoNote" : "landing.realNote")}</p>
        </div>
      </section>
    </main>
  );
}
