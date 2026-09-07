import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession, homePathForRole } from "@/server/session";
import { AccountForms } from "@/components/account/account-forms";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession("/account");

  return (
    <main id="main" className="mx-auto w-full max-w-xl px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-4">
        <Logo schoolName={session.school?.name} />
        <Link
          href={homePathForRole(session.profile.role)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--color-muted)] transition hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      <h1 className="mt-8 text-3xl font-extrabold tracking-[-0.03em]">Your account</h1>
      <p className="mt-1.5 text-[14px] text-[var(--color-muted)]">
        Signed in as {session.email} ·{" "}
        <span className="capitalize">
          {session.profile.role === "admin" ? "Administrator" : session.profile.role}
        </span>
      </p>

      <AccountForms
        fullName={session.profile.full_name}
        phone={session.profile.phone}
        vehicle={session.profile.vehicle_description}
        showVehicle={session.profile.role === "parent"}
      />

      <div className="mt-10 border-t border-[var(--color-hairline)] pt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
