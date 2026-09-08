"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DoorOpen, Hand, Users } from "lucide-react";
import { homePathForRole, useSession } from "@/lib/api/session";
import { IS_CONFIGURED } from "@/lib/api/config";
import { useI18n } from "@/lib/i18n/provider";
import { BRAND } from "@/lib/brand";
import { Logo, LogoArabic, LogoMark } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { LoginForm } from "@/components/auth/login-form";
import { SetupNotice } from "@/components/setup-notice";
import { BootScreen } from "@/components/boot-screen";

export default function LoginPage() {
  const { session } = useSession();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace(homePathForRole(session.profile.role));
  }, [session, router]);

  if (session) return <BootScreen />;
  if (!IS_CONFIGURED) return <SetupNotice />;

  const steps = [
    { icon: Hand, text: t("landing.feature.parents.body") },
    { icon: DoorOpen, text: t("landing.feature.teachers.body") },
    { icon: Users, text: t("landing.feature.classes.body") },
  ];

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <motion.div
            className="flex items-center justify-between gap-3"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Logo />
            <LanguageToggle />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="mt-9 text-3xl font-extrabold tracking-[-0.03em]">{t("login.title")}</h1>
            <p className="mt-2 text-[15px] text-[var(--color-muted)]">{t("login.subtitle")}</p>
          </motion.div>

          <LoginForm />

          <p className="mt-8 text-[13px] leading-relaxed text-[var(--color-muted)]">
            {t("login.accountsNote")}
          </p>
        </div>
      </div>

      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(155deg,var(--color-brand-600),var(--color-brand-800)_55%,var(--color-brand-950))]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]"
        />
        <motion.div
          aria-hidden
          className="absolute -end-24 top-1/4 size-[32rem] rounded-full bg-gold-500/10 blur-3xl"
          animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.06, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <motion.div
            className="flex items-center gap-5"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <LogoMark className="size-24" />
            <div>
              <p className="text-2xl font-bold leading-tight tracking-[-0.02em]">{BRAND.name}</p>
              <LogoArabic className="mt-1 text-lg text-white/75" />
            </div>
          </motion.div>

          <ol className="space-y-6">
            {steps.map(({ icon: Icon, text }, index) => (
              <motion.li
                key={index}
                className="flex items-start gap-4"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + index * 0.09, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="size-5 text-gold-300" />
                </span>
                <p className="max-w-md text-[17px] leading-relaxed text-white/85">{text}</p>
              </motion.li>
            ))}
          </ol>

          <p className="text-sm text-white/55">{t("app.tagline")}</p>
        </div>
      </aside>
    </main>
  );
}
