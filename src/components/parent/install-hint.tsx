"use client";

import * as React from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { useClientFlag } from "@/hooks/use-client-flag";
import { useI18n } from "@/lib/i18n/provider";

const DISMISS_KEY = "map-dismissals:install-hint-dismissed";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function alreadyInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function previouslyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Private browsing — treat as "not dismissed" and show the hint.
    return false;
  }
}

/**
 * Nudges parents to install the PWA — a home-screen icon is the difference
 * between "I'm Here" being one tap or five.
 */
export function InstallHint() {
  const { t } = useI18n();
  const [deferred, setDeferred] = React.useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  const isIos = useClientFlag(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent));
  const eligible = useClientFlag(() => !alreadyInstalled() && !previouslyDismissed());

  React.useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to do — the hint simply returns next visit.
    }
  }

  // iOS has no install prompt event, so we show manual instructions instead.
  const visible = eligible && !dismissed && (isIos || deferred !== null);
  if (!visible) return null;

  return (
    <div className="relative mt-7 flex items-start gap-3 rounded-2xl bg-[var(--color-surface)] p-4 pe-11 ring-1 ring-[var(--color-hairline)]">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        {isIos ? <Share className="size-[18px]" /> : <SquarePlus className="size-[18px]" />}
      </span>

      <div className="min-w-0">
        <p className="text-[14px] font-semibold">{t("parent.install.title")}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-muted)]">
          {t(isIos ? "parent.install.ios" : "parent.install.android")}
        </p>

        {deferred ? (
          <button
            type="button"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              dismiss();
            }}
            className="mt-2.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-brand-700"
          >
            {t("parent.install.button")}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.close")}
        className="absolute end-2 top-2 rounded-lg p-2 text-[var(--color-muted)] transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
