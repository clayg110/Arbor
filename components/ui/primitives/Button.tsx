"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/format";

// Shared button primitive. Variants/sizes match the existing hand-rolled buttons
// (blue #185FA5 primary, hairline secondary, weight-medium, 12–13px) so adopting
// it is a visual no-op — it just centralizes focus ring, loading spinner, and the
// subtle active-press so every button gets them for free.

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[#185FA5] text-white hover:bg-[#15528f]",
  secondary:
    "border-hairline bg-surface text-muted hover:text-ink hover:border-[#d8d5cc]",
  ghost: "text-muted hover:text-ink hover:bg-[#F1EFE8]",
  danger: "bg-[#C0322F] text-white hover:bg-[#a82a27]",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12px]",
  md: "px-4 py-2 text-[13px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "sm",
    loading = false,
    disabled,
    className,
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && (
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
});
