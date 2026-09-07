"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useSession } from "@/lib/api/session";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  label = "Sign out",
  compact = false,
}: {
  className?: string;
  label?: string;
  compact?: boolean;
}) {
  const { signOut } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.replace("/login");
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl text-sm font-medium transition disabled:opacity-60",
        compact
          ? "w-full px-3 py-2 text-[var(--color-muted)] hover:bg-black/[0.05] hover:text-[var(--color-ink)] dark:hover:bg-white/[0.07]"
          : "bg-[var(--color-surface)] px-4 py-2.5 text-[var(--color-ink)] shadow-soft ring-1 ring-[var(--color-hairline)] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
        className,
      )}
    >
      <LogOut className="size-4 shrink-0" />
      {label}
    </button>
  );
}
