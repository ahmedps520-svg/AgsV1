"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, MailCheck, Sparkles } from "lucide-react";
import { sendPasswordResetAction } from "@/lib/api/mutations";
import { homePathForRole, useSession } from "@/lib/api/session";
import { IS_DEMO } from "@/lib/api/config";
import { DEMO_ACCOUNTS } from "@/lib/api/demo-data";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorMessage } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useSession();
  const { t } = useI18n();

  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [resetState, sendReset, sendingReset] = useActionState(sendPasswordResetAction, null);

  function landing(role: UserRole, homeroom?: string) {
    if (homeroom && role !== "parent") return `/board/?c=${encodeURIComponent(homeroom)}`;
    return homePathForRole(role);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn(email, password);
    setBusy(false);

    if (result.error) {
      setError(IS_DEMO ? t("login.demo.wrongAccount") : t("login.failed"));
      return;
    }

    const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === email.trim().toLowerCase());
    router.replace(account ? landing(account.role, account.homeroom) : "/");
  }

  async function signInAsDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    setBusy(true);
    setEmail(account.email);
    const result = await signIn(account.email, "demo");
    setBusy(false);

    if (result.error) {
      setError(t("login.demo.wrongAccount"));
      return;
    }
    router.replace(landing(account.role, account.homeroom));
  }

  if (mode === "reset") {
    return (
      <div className="mt-8">
        {resetState?.ok ? (
          <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
            <MailCheck className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-3 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {t("login.reset.sentTitle")}
            </p>
            <p className="mt-1 text-[13px] text-emerald-800/80 dark:text-emerald-200/80">
              {t("login.reset.sentBody")}
            </p>
          </div>
        ) : (
          <form action={sendReset} className="space-y-4">
            <Field label={t("login.email")} htmlFor="reset-email">
              <Input id="reset-email" name="email" type="email" autoComplete="email" required data-autofocus />
            </Field>
            {resetState && !resetState.ok ? <ErrorMessage>{resetState.error}</ErrorMessage> : null}
            <Button type="submit" size="lg" className="w-full" loading={sendingReset}>
              {t("login.reset.send")}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className="mt-5 w-full text-center text-[13px] font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          {t("login.reset.back")}
        </button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label={t("login.email")} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            data-autofocus
          />
        </Field>

        <Field label={t("login.password")} htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required={!IS_DEMO}
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={IS_DEMO ? t("login.passwordDemoHint") : "••••••••"}
              className="pe-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={t(showPassword ? "login.hidePassword" : "login.showPassword")}
              className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {error ? <ErrorMessage>{error}</ErrorMessage> : null}

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {!busy ? <LogIn className="size-4 rtl:rotate-180" /> : null}
          {t("common.signIn")}
        </Button>

        {!IS_DEMO ? (
          <button
            type="button"
            onClick={() => setMode("reset")}
            className="w-full text-center text-[13px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          >
            {t("login.forgot")}
          </button>
        ) : null}
      </form>

      {IS_DEMO ? (
        <section className="mt-8 rounded-2xl border border-dashed border-[var(--color-hairline)] p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Sparkles className="size-4 text-gold-600" />
            {t("login.demo.title")}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-muted)]">{t("login.demo.body")}</p>

          <ul className="mt-3 space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => signInAsDemo(account)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition",
                    "hover:bg-black/[0.04] disabled:opacity-60 dark:hover:bg-white/[0.06]",
                  )}
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                    {t(`role.${account.role}`)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{account.name}</span>
                    <span className="block text-[12px] text-[var(--color-muted)]">{t(account.blurbKey)}</span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--color-muted)]" dir="ltr">
                      {account.email}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
