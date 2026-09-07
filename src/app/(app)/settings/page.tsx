"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useRequireRole } from "@/components/auth/require-role";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { Skeleton } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const { session, ready } = useRequireRole(["admin"]);
  const { t } = useI18n();

  return (
    <PageBody>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
        action={
          <Link
            href="/account"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-surface)] px-4 text-sm font-medium shadow-soft ring-1 ring-inset ring-[var(--color-hairline)] transition hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
          >
            <ExternalLink className="size-4" />
            {t("common.account")}
          </Link>
        }
      />
      <div className="max-w-2xl">
        {ready && session?.school ? (
          <SettingsForm school={session.school} />
        ) : (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}
      </div>
    </PageBody>
  );
}
