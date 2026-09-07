"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";

/**
 * In-app back navigation.
 *
 * The arrow flips in Arabic (`rtl:rotate-180`) so it always points "back"
 * rather than left.
 */
export function BackLink({
  href,
  labelKey = "common.back",
  className,
  tone = "light",
}: {
  href: string;
  labelKey?: MessageKey;
  className?: string;
  tone?: "light" | "dark";
}) {
  const { t } = useI18n();

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition",
        tone === "dark"
          ? "bg-white/10 text-white hover:bg-white/[0.16]"
          : "text-[var(--color-muted)] hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10",
        className,
      )}
    >
      <ArrowLeft className="size-4 rtl:rotate-180" />
      {t(labelKey)}
    </Link>
  );
}
