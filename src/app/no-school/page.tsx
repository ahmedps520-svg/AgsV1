"use client";

import { Building2 } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default function NoSchoolPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <LogoMark className="size-14" />
      <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Building2 className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-[-0.02em]">Almost there</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-muted)]">
        Your account isn&apos;t linked to a school yet. An administrator needs to add you before you
        can manage dismissal.
      </p>
      <div className="mt-7">
        <SignOutButton />
      </div>
    </main>
  );
}
