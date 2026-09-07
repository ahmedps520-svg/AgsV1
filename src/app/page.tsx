import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  MonitorSpeaker,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession, homePathForRole } from "@/server/session";
import { SetupNotice } from "@/components/setup-notice";
import { Logo } from "@/components/logo";

export default async function HomePage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await getSession();
  if (session) redirect(homePathForRole(session.profile.role));

  return (
    <main id="main" className="relative min-h-dvh overflow-hidden">
      {/* Ambient brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_10%_-10%,var(--color-brand-100)_0%,transparent_55%),radial-gradient(90%_70%_at_95%_5%,#dbeafe_0%,transparent_60%)] dark:bg-[radial-gradient(120%_80%_at_10%_-10%,rgba(91,75,219,0.22)_0%,transparent_55%),radial-gradient(90%_70%_at_95%_5%,rgba(37,99,235,0.16)_0%,transparent_60%)]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link
          href="/login"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
        >
          Sign in
          <ArrowRight className="size-4" />
        </Link>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-10 sm:pt-16">
        <p className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-muted)] ring-1 ring-[var(--color-hairline)]">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-2 animate-[halo_2.6s_ease-out_infinite] rounded-full bg-emerald-500" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live dismissal, every afternoon
        </p>

        <h1 className="mt-6 max-w-3xl text-balance text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
          Dismissal that runs itself.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)] sm:text-xl">
          Parents tap <span className="font-semibold text-[var(--color-ink)]">I&apos;m Here</span>{" "}
          from the pickup line. Staff work one live queue. The board on the wall updates the instant
          a student is called — no refreshing, no radios, no clipboard.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lift transition hover:bg-brand-700 active:scale-[0.99]"
          >
            Sign in to your school
            <ArrowRight className="size-5" />
          </Link>
          <Link
            href="/board"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-surface)] px-7 py-3.5 text-base font-semibold text-[var(--color-ink)] shadow-soft ring-1 ring-[var(--color-hairline)] transition hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
          >
            <MonitorSpeaker className="size-5" />
            Open the dismissal board
          </Link>
        </div>

        <dl className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Smartphone,
              title: "For parents & drivers",
              body: "One tap on arrival. A live status card that tracks the pickup from request to handover.",
            },
            {
              icon: Zap,
              title: "For staff",
              body: "A single queue with search, call-next, and one-tap status changes. Everything syncs instantly.",
            },
            {
              icon: MonitorSpeaker,
              title: "For the hallway",
              body: "A fullscreen board built to be read from across a room, updating the moment a name is called.",
            },
            {
              icon: ShieldCheck,
              title: "Locked down",
              body: "Row-level security means a parent can only ever see the students they're authorised to collect.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="surface-card p-5">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <Icon className="size-5" />
              </span>
              <dt className="mt-4 text-[15px] font-semibold tracking-tight">{title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{body}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex items-center gap-3 rounded-2xl bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted)] ring-1 ring-[var(--color-hairline)]">
          <Bell className="size-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <p>
            Accounts are created by your school administrator. If you can&apos;t sign in, contact the
            school office.
          </p>
        </div>
      </section>
    </main>
  );
}
