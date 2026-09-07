"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRequireRole } from "@/components/auth/require-role";
import { homePathForRole } from "@/lib/api/session";
import { useI18n } from "@/lib/i18n/provider";
import { AccountForms } from "@/components/account/account-forms";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/logo";
import { BootScreen } from "@/components/boot-screen";

export default function AccountPage() {
  const { session, ready } = useRequireRole("any");
  const { t } = useI18n();

  if (!ready || !session) return <BootScreen />;

  return (
    <main id="main" className="mx-auto w-full max-w-xl px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-4">
        <Logo schoolName={session.school?.name} compact />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link
            href={homePathForRole(session.profile.role)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--color-muted)] transition hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("common.back")}
          </Link>
        </div>
      </div>

      <h1 className="mt-8 text-3xl font-extrabold tracking-[-0.03em]">{t("account.title")}</h1>
      <p className="mt-1.5 text-[14px] text-[var(--color-muted)]">
        {t("account.signedInAs", { email: session.email ?? "" })} · {t(`role.${session.profile.role}`)}
      </p>

      <AccountForms
        fullName={session.profile.full_name}
        phone={session.profile.phone}
        vehicle={session.profile.vehicle_description}
        showVehicle={session.profile.role === "parent"}
      />

      <div className="mt-10 border-t border-[var(--color-hairline)] pt-6">
        <SignOutButton label={t("common.signOut")} />
      </div>
    </main>
  );
}
