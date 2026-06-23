"use client";

import { useRef } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { XIcon } from "../icons";
import { cn } from "@/lib/format";

// Shared modal shell. Centralizes the overlay, focus trap (Tab cycle + Escape +
// restore focus), backdrop blur/fade, and a scale-in entrance so every dialog
// animates and traps focus identically. Backdrop click and the X both close.

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
} as const;

export function Modal({
  title,
  onClose,
  children,
  size = "md",
  className,
  labelledBy,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof SIZES;
  className?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "animate-scale-in w-full rounded-xl border-hairline bg-surface p-5",
          SIZES[size],
          className
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-medium text-ink">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="focus-ring rounded text-subtle transition-colors hover:text-ink"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
