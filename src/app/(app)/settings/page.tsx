import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/server/session";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAdmin("/settings");

  return (
    <PageBody>
      <PageHeader
        title="Dismissal settings"
        description="These apply to every device in your school the moment you save."
        action={
          <Link
            href="/account"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-surface)] px-4 text-sm font-medium shadow-soft ring-1 ring-inset ring-[var(--color-hairline)] transition hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
          >
            <ExternalLink className="size-4" />
            Your account
          </Link>
        }
      />
      <div className="max-w-2xl">
        <SettingsForm school={session.school!} />
      </div>
    </PageBody>
  );
}
