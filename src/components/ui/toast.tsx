"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useIsMounted } from "@/hooks/use-client-flag";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: { tone?: ToastTone; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: React.ElementType; className: string }> = {
  success: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  error: { icon: AlertTriangle, className: "text-rose-600 dark:text-rose-400" },
  info: { icon: Info, className: "text-brand-600 dark:text-brand-400" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const mounted = useIsMounted();
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue["toast"]>(
    ({ tone = "info", title, description }) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 6500 : 4000);
    },
    [dismiss],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: "success", title, description }),
      error: (title, description) => toast({ tone: "error", title, description }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              aria-live="polite"
              role="status"
              className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0 sm:pb-0"
            >
              <AnimatePresence initial={false}>
                {toasts.map((item) => {
                  const { icon: Icon, className } = TONE_STYLES[item.tone];
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 460, damping: 32 }}
                      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-[var(--color-surface)] p-3.5 shadow-lift ring-1 ring-[var(--color-hairline)]"
                    >
                      <Icon className={cn("mt-0.5 size-5 shrink-0", className)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--color-ink)]">{item.title}</p>
                        {item.description ? (
                          <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-muted)]">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => dismiss(item.id)}
                        className="rounded-md p-1 text-[var(--color-muted)] transition hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <X className="size-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
