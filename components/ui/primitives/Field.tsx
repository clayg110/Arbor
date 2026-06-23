"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/format";

// Form-control primitives. Input/Select carry the hairline + focus ring; Field
// wraps a labelled control with optional hint/error text. These mirror the
// inline-styled inputs already in use so swapping them in is visually neutral.

const CONTROL =
  "focus-ring w-full rounded-md border-hairline bg-surface text-ink transition-shadow placeholder:text-subtle";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(CONTROL, "px-3 py-2 text-[13px]", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(CONTROL, "px-2.5 py-2 text-[13px]", className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-normal text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-subtle">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-[#C0322F]">{error}</p>}
    </div>
  );
}
