"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** EN / ع switch. `tone="dark"` is for the navy class board. */
export function LanguageToggle({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl p-0.5",
        tone === "dark" ? "bg-white/10" : "bg-black/[0.05] dark:bg-white/[0.08]",
        className,
      )}
    >
      <Languages
        className={cn("ms-2 me-1 size-4", tone === "dark" ? "text-white/60" : "text-[var(--color-muted)]")}
        aria-hidden
      />
      {(["en", "ar"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          lang={option}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition",
            locale === option
              ? tone === "dark"
                ? "bg-white text-brand-800 shadow-soft"
                : "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-soft"
              : tone === "dark"
                ? "text-white/70 hover:text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
          )}
        >
          {option === "en" ? "EN" : "ع"}
        </button>
      ))}
    </div>
  );
}
