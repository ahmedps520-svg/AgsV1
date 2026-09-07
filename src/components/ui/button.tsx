"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "subtle";
type Size = "sm" | "md" | "lg" | "xl" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-soft hover:bg-brand-700 active:bg-brand-800 disabled:hover:bg-brand-600",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-ink)] ring-1 ring-inset ring-[var(--color-hairline)] shadow-soft hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
  subtle:
    "bg-black/[0.04] text-[var(--color-ink)] hover:bg-black/[0.07] dark:bg-white/[0.07] dark:hover:bg-white/[0.11]",
  ghost: "text-[var(--color-muted)] hover:bg-black/[0.05] hover:text-[var(--color-ink)] dark:hover:bg-white/[0.07]",
  danger: "bg-rose-600 text-white shadow-soft hover:bg-rose-700 active:bg-rose-800",
  success: "bg-emerald-600 text-white shadow-soft hover:bg-emerald-700 active:bg-emerald-800",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px] rounded-lg",
  md: "h-10 gap-2 px-4 text-sm rounded-xl",
  lg: "h-12 gap-2 px-5 text-[15px] rounded-xl",
  xl: "h-16 gap-3 px-7 text-lg rounded-2xl",
  icon: "h-10 w-10 rounded-xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "active:scale-[0.985] motion-reduce:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
