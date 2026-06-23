"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// Lightweight, dependency-free toast system. `useToast()` returns a `toast(msg,
// variant?)` fn; the provider renders a bottom-right stack in a portal with a
// polite live region, fade-in-up entrance, auto-dismiss, and manual close. A
// colored left accent encodes the variant. Mount <ToastProvider> once near the
// app root.

type Variant = "success" | "error" | "info";
type ToastItem = { id: number; message: string; variant: Variant };

const ACCENT: Record<Variant, string> = {
  success: "#157A5A",
  error: "#C0322F",
  info: "#185FA5",
};

const ToastContext = createContext<(message: string, variant?: Variant) => void>(
  () => {}
);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: Variant = "success") => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, variant }]);
      setTimeout(() => remove(id), 3500);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2"
            aria-live="polite"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className="animate-fade-in-up pointer-events-auto flex w-72 items-start gap-2.5 rounded-lg border-hairline bg-surface px-3.5 py-2.5 shadow-sm"
                style={{ borderLeft: `2px solid ${ACCENT[t.variant]}` }}
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ACCENT[t.variant] }}
                  aria-hidden
                />
                <p className="flex-1 text-[12px] leading-snug text-ink">{t.message}</p>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss"
                  className="focus-ring -mr-1 -mt-0.5 rounded text-subtle transition-colors hover:text-ink"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
