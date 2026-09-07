"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, MailCheck } from "lucide-react";
import { sendPasswordResetAction, signInAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorMessage } from "@/components/ui/primitives";

export function LoginForm({
  nextPath,
  notice,
}: {
  nextPath: string | null;
  notice: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");
  const [showPassword, setShowPassword] = useState(false);

  const [signInState, signIn, signingIn] = useActionState(signInAction, null);
  const [resetState, sendReset, sendingReset] = useActionState(sendPasswordResetAction, null);

  useEffect(() => {
    if (signInState?.ok) {
      router.replace(signInState.data.redirectTo);
      router.refresh();
    }
  }, [signInState, router]);

  if (mode === "reset") {
    return (
      <div className="mt-8">
        {resetState?.ok ? (
          <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
            <MailCheck className="mx-auto size-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-3 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Check your inbox
            </p>
            <p className="mt-1 text-[13px] text-emerald-800/80 dark:text-emerald-200/80">
              If that address belongs to an account, a reset link is on its way.
            </p>
          </div>
        ) : (
          <form action={sendReset} className="space-y-4">
            <Field label="Email address" htmlFor="reset-email">
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@school.edu"
                data-autofocus
              />
            </Field>
            {resetState && !resetState.ok ? <ErrorMessage>{resetState.error}</ErrorMessage> : null}
            <Button type="submit" size="lg" className="w-full" loading={sendingReset}>
              Send reset link
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className="mt-5 w-full text-center text-[13px] font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form action={signIn} className="mt-8 space-y-4">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      {notice ? <ErrorMessage>{notice}</ErrorMessage> : null}

      <Field label="Email address" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@school.edu"
          data-autofocus
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      {signInState && !signInState.ok ? <ErrorMessage>{signInState.error}</ErrorMessage> : null}

      <Button type="submit" size="lg" className="w-full" loading={signingIn}>
        {!signingIn ? <LogIn className="size-4" /> : null}
        Sign in
      </Button>

      <button
        type="button"
        onClick={() => setMode("reset")}
        className="w-full text-center text-[13px] font-medium text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
      >
        Forgot your password?
      </button>
    </form>
  );
}
