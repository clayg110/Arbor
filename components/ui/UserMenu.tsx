"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DarkModeToggle } from "@/components/ui/DarkModeToggle";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface MenuUser {
  email: string;
  role: string;
}

function initialsOf(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[.\-_]/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() ||
    name.slice(0, 2).toUpperCase() ||
    "?"
  );
}

// Avatar button that opens an account menu: identity, theme control, and (when
// signed in) Settings + Sign out. Consolidating these here keeps the header bar
// compact so the centered nav doesn't crowd the logo.
export function UserMenu({
  user,
  onSignOut,
}: {
  user: MenuUser | null;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click (the trigger is inside the container, so toggling
  // stays consistent). Escape + focus handling come from useFocusTrap below.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const initials = user ? initialsOf(user.email) : "PN";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={user ? `Account menu for ${user.email}` : "Account menu"}
        title={user?.email ?? "Account"}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1EFE8] text-[11px] font-medium text-[#444441]"
      >
        {initials}
      </button>

      {open && (
        <MenuPanel user={user} onClose={() => setOpen(false)} onSignOut={onSignOut} />
      )}
    </div>
  );
}

function MenuPanel({
  user,
  onClose,
  onSignOut,
}: {
  user: MenuUser | null;
  onClose: () => void;
  onSignOut?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);

  const itemCls =
    "block w-full rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-muted hover:bg-[#F1EFE8] hover:text-ink";

  return (
    <div
      ref={ref}
      aria-label="Account"
      className="absolute right-0 z-30 mt-2 w-56 rounded-lg bg-surface p-1.5 shadow-lg"
      style={{ border: "0.5px solid var(--border)" }}
    >
      {user ? (
        <div className="px-3 py-2">
          <div className="truncate text-[12px] font-medium text-ink">{user.email}</div>
          <div className="text-[10px] font-normal uppercase tracking-wide text-subtle">
            {user.role}
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 text-[12px] font-medium text-muted">Demo mode</div>
      )}

      <div className="my-1 h-px" style={{ backgroundColor: "var(--border)" }} />

      <div className="px-3 py-1.5">
        <div className="mb-1.5 text-[10px] font-normal uppercase tracking-wide text-subtle">
          Theme
        </div>
        <DarkModeToggle />
      </div>

      {user && (
        <>
          <div className="my-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          <Link href="/settings" onClick={onClose} className={itemCls}>
            Settings
          </Link>
          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className={itemCls}
            >
              Sign out
            </button>
          )}
        </>
      )}
    </div>
  );
}
