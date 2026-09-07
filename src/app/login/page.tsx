import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession, homePathForRole } from "@/server/session";
import { SetupNotice } from "@/components/setup-notice";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await getSession();
  const params = await searchParams;

  if (session) redirect(params.next || homePathForRole(session.profile.role));

  const notice =
    params.error === "inactive"
      ? "This account has been deactivated. Please contact your school office."
      : params.error === "callback"
        ? "That sign-in link has expired. Request a new one below."
        : null;

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

          <LoginForm nextPath={params.next ?? null} notice={notice} />

          <p className="mt-8 text-[13px] leading-relaxed text-[var(--color-muted)]">
            Accounts are issued by your school. If you don&apos;t have one yet, contact the school
            office and they&apos;ll set you up in a minute.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-[13px] font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            ← Back to overview
          </Link>
        </div>
      </div>

      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(150deg,var(--color-brand-600),var(--color-brand-800)_55%,#1e1b4b)]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]"
        />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <blockquote className="max-w-md">
            <p className="text-3xl font-bold leading-tight tracking-[-0.02em]">
              &ldquo;Pickup used to take forty minutes and three radios. Now it&apos;s one screen and
              everyone knows what&apos;s happening.&rdquo;
            </p>
            <footer className="mt-6 text-sm font-medium text-white/70">
              Deputy Head of School · 940 students
            </footer>
          </blockquote>

          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/15 pt-8">
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
