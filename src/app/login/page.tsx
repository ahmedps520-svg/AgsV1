"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { homePathForRole, useSession } from "@/lib/api/session";
import { IS_DEMO } from "@/lib/api/config";
import { BRAND } from "@/lib/brand";
import { Logo, LogoArabic } from "@/components/logo";
import { LoginForm } from "@/components/auth/login-form";
import { BootScreen } from "@/components/boot-screen";

export default function LoginPage() {
  const { session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace(homePathForRole(session.profile.role));
  }, [session, router]);

  if (status === "loading" || session) return <BootScreen />;

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2">
      {/* Form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-9 text-3xl font-extrabold tracking-[-0.03em]">Welcome back</h1>
          <p className="mt-2 text-[15px] text-[var(--color-muted)]">
            Sign in to manage dismissal or check on your student.
          </p>

          <LoginForm
            notice={
              IS_DEMO
                ? null
                : null
            }
          />

          {!IS_DEMO ? (
            <p className="mt-8 text-[13px] leading-relaxed text-[var(--color-muted)]">
              Accounts are issued by the school. If you don&apos;t have one yet, contact the school
              office and they&apos;ll set you up in a minute.
            </p>
          ) : null}

          <Link
            href="/"
            className="mt-4 inline-block text-[13px] font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            ← Back to overview
          </Link>
        </div>
      </div>

      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(155deg,var(--color-brand-600),var(--color-brand-800)_55%,var(--color-brand-950))]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]"
        />
        {/* Gold crest sweep */}
        <div
          aria-hidden
          className="absolute -right-24 top-1/4 size-[32rem] rounded-full bg-gold-500/10 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-gold-300">
              {BRAND.shortName}
            </p>
            <p className="mt-3 max-w-sm text-2xl font-bold leading-tight tracking-[-0.02em]">
              {BRAND.name}
            </p>
            <LogoArabic className="mt-2 text-lg text-white/70" />
          </div>

          <blockquote className="max-w-md">
            <p className="text-3xl font-bold leading-tight tracking-[-0.02em]">
              &ldquo;Pickup used to take forty minutes and three radios. Now it&apos;s one screen and
              everyone knows what&apos;s happening.&rdquo;
            </p>
            <footer className="mt-6 text-sm font-medium text-white/60">
              Deputy Head of School
            </footer>
          </blockquote>

          <div className="grid grid-cols-3 gap-6 border-t border-white/15 pt-8">
            {[
              { value: "< 1s", label: "Board update" },
              { value: "3", label: "Taps to pick up" },
              { value: "100%", label: "Auditable" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-extrabold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-[13px] text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
