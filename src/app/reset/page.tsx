"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { sendPasswordResetAction } from "@/lib/api/mutations";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorMessage } from "@/components/ui/primitives";
import { BackLink } from "@/components/layout/back-link";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";

export default function ResetPage() {
  const { t } = useI18n();
  const [state, send, sending] = useActionState(sendPasswordResetAction, null);

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <LanguageToggle />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {state?.ok ? (
          <div className="mt-9 rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
            <MailCheck className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-3 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {t("login.reset.sentTitle")}
            </p>
            <p className="mt-1 text-[13px] text-emerald-800/80 dark:text-emerald-200/80">
              {t("login.reset.sentBody")}
            </p>
          </div>
        ) : (
          <form action={send} className="mt-9 space-y-4">
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">{t("login.forgot")}</h1>
            <Field label={t("login.email")} htmlFor="reset-email">
              <Input id="reset-email" name="email" type="email" autoComplete="username" required dir="ltr" data-autofocus />
            </Field>
            {state && !state.ok ? <ErrorMessage>{state.error}</ErrorMessage> : null}
            <Button type="submit" size="lg" className="w-full" loading={sending}>
              {t("login.reset.send")}
            </Button>
          </form>
        )}
      </motion.div>

      <BackLink href="/login" className="mt-6 -ms-2 self-start" />
    </main>
  );
}
