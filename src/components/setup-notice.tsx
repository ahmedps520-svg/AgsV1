import { Database, Terminal } from "lucide-react";
import { LogoMark } from "@/components/logo";

/**
 * Rendered instead of crashing when the Supabase environment variables are
 * missing. This is what the published site shows until the school's project is
 * connected, so it lists the deployment steps rather than a developer's.
 */
export function SetupNotice() {
  const steps = [
    {
      label: "Create a Supabase project",
      detail: "supabase.com/dashboard → New project",
    },
    {
      label: "Apply the schema",
      detail: "Paste supabase/install.sql into the SQL editor",
    },
    {
      label: "Run supabase/setup.sql in the SQL editor",
      detail: "Creates the school, every class and the four staff logins",
    },
    {
      label: "Add the two repository variables",
      detail: "Settings → Secrets and variables → Actions → Variables",
    },
    {
      label: "Re-run the deploy workflow",
      detail: "Actions → Deploy to GitHub Pages → Run workflow",
    },
  ];

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-6 py-16">
      <LogoMark className="size-11" />
      <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.03em]">Finish setting up</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
        AGS Dismissal needs a Supabase project for sign-in, the database and real-time updates.
        Nothing here is simulated, so until it is connected there is nothing to show.
      </p>

      <ol className="mt-8 space-y-3">
        {steps.map((step, index) => (
          <li key={step.label} className="surface-card flex items-start gap-4 p-4">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[13px] font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{step.label}</p>
              <code className="mt-1 block truncate font-mono text-[12.5px] text-[var(--color-muted)]">
                {step.detail}
              </code>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-[13px] leading-relaxed text-brand-900 ring-1 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-100 dark:ring-brand-400/20">
        <Terminal className="mt-0.5 size-4 shrink-0" />
        <p>
          Working on a local clone instead? <code className="font-mono">cp .env.example .env.local</code>,
          fill in the two values, then <code className="font-mono">supabase start</code> and{" "}
          <code className="font-mono">supabase db reset</code> to get the schema and a small
          development school from <code className="font-mono">supabase/seed.sql</code>.
        </p>
      </div>

      <p className="mt-6 flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
        <Database className="size-4" />
        Every step in detail: <code className="font-mono">DEPLOYMENT.md</code>.
      </p>
    </main>
  );
}
