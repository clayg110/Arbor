"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "arbor-cookie-notice-ack";

// Lightweight notice — we use only essential auth cookies, so this is an
// acknowledgement (not a consent gate). Hidden once dismissed.
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // localStorage unavailable (private mode) — just don't show.
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[560px] rounded-lg bg-surface p-3 shadow-lg sm:inset-x-auto sm:right-4"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
        <p className="flex-1">
          We use only essential cookies for sign-in.{" "}
          <Link href="/legal/privacy" className="underline hover:text-ink">
            Learn more
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
          style={{ backgroundColor: "#185FA5" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
