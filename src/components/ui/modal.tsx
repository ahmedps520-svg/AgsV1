"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useIsMounted } from "@/hooks/use-client-flag";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** `auto` renders a bottom sheet on phones and a centred dialog on desktop. */
  variant?: "auto" | "center" | "sheet";
  size?: "sm" | "md" | "lg";
  closeOnBackdrop?: boolean;
}

const SIZES = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "auto",
  size = "md",
  closeOnBackdrop = true,
}: ModalProps) {
  const mounted = useIsMounted();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Escape to dismiss, and keep the page behind from scrolling.
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    const focusTimer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input:not([type=hidden]), textarea, select, button",
      );
      target?.focus();
    }, 60);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const isSheet = variant === "sheet";
  const isAuto = variant === "auto";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px]"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={{ opacity: 0, y: isSheet || isAuto ? 24 : 8, scale: isSheet ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isSheet || isAuto ? 20 : 8, scale: isSheet ? 1 : 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-[var(--color-surface)] shadow-pop",
              "rounded-t-3xl sm:rounded-3xl",
              isSheet ? "sm:max-w-lg" : SIZES[size],
            )}
          >
            {/* Sheet grabber */}
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-black/10 sm:hidden dark:bg-white/15" />

            {title ? (
              <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4 sm:px-6 sm:pt-6">
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="text-lg font-semibold tracking-tight text-[var(--color-ink)]"
                  >
                    {title}
                  </h2>
                  {description ? (
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1 -mt-1 rounded-lg p-2 text-[var(--color-muted)] transition hover:bg-black/5 hover:text-[var(--color-ink)] dark:hover:bg-white/10"
                >
                  <X className="size-5" />
                </button>
              </div>
            ) : null}

            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6">
              {children}
            </div>

            {footer ? (
              <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-hairline)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:justify-end sm:px-6 sm:pb-5">
                {footer}
              </div>
            ) : (
              <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4" />
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
