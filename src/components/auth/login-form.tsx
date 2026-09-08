"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useSession } from "@/lib/api/session";
import { IS_CONFIGURED } from "@/lib/api/config";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorMessage } from "@/components/ui/primitives";

/** Straight email + password. Nothing else stands between staff and the board. */
export function LoginForm() {
  const router = useRouter();
  const { signIn } = useSession();
  const { t } = useI18n();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!IS_CONFIGURED) {
      setError(t("login.notConfigured"));
      return;
    }

    setBusy(true);
    setError(null);

    const result = await signIn(email, password);

    if (result.error) {
      setBusy(false);
      setError(result.error === "invalid" ? t("login.invalid") : result.error);
      return;
    }

    // Leave the button in its loading state through the redirect so the form
    // never flashes back to idle.
    router.replace("/");
  }

  return (
    <motion.form
      onSubmit={submit}
      className="mt-8 space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Field label={t("login.email")} htmlFor="email">
        <div className="relative">
          <Mail className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="dismissal.boys@ags.edu.sa"
            className="ps-10"
            data-autofocus
          />
        </div>
      </Field>

      <Field label={t("login.password")} htmlFor="password">
        <div className="relative">
          <Lock className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="ps-10 pe-11"
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

      <Button type="submit" size="lg" className="group w-full" loading={busy}>
        {busy ? t("login.signingIn") : t("common.signIn")}
        {!busy ? (
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        ) : null}
      </Button>

      <button
        type="button"
        onClick={() => router.push("/reset")}
        className="w-full text-center text-[13px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
      >
        {t("login.forgot")}
      </button>
    </motion.form>
  );
}
