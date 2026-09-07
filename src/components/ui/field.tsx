import * as React from "react";
import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-xl bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] " +
  "ring-1 ring-inset ring-[var(--color-hairline)] transition placeholder:text-[var(--color-muted)] " +
  "focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(CONTROL, "min-h-24 resize-y", className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL, "appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-medium text-[var(--color-ink)]", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-[13px] font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  name,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3.5 rounded-xl p-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          checked ? "bg-brand-600" : "bg-black/15 dark:bg-white/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
      {name ? <input type="hidden" name={name} value={checked ? "on" : ""} /> : null}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--color-ink)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[13px] text-[var(--color-muted)]">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
