"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellIcon } from "./icons";
import { api, BackendOff, type NotificationView } from "@/lib/api-client";

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Header bell: unread badge + dropdown. Polls every 60s. Renders nothing in mock
// mode (backend off) so the demo stays clean.
export function NotificationBell() {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { notifications, unread } = await api.notifications();
      setItems(notifications);
      setUnread(unread);
    } catch (e) {
      if (e instanceof BackendOff) setOffline(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((p) =>
        p.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
      );
      try {
        await api.markNotificationsRead();
      } catch {
        /* best-effort */
      }
    }
  }

  if (offline) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative text-muted hover:text-ink"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-medium text-white"
            style={{ backgroundColor: "#E24B4A" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-lg bg-surface"
          style={{
            border: "0.5px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
          }}
        >
          <div
            className="px-3 py-2 text-[12px] font-medium text-ink"
            style={{ borderBottom: "0.5px solid var(--border)" }}
          >
            Notifications
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-subtle">Nothing yet</p>
            ) : (
              items.map((n) => {
                const inner = (
                  <>
                    <div className="text-[13px] font-medium text-ink">{n.title}</div>
                    {n.body && <div className="text-[12px] text-muted">{n.body}</div>}
                    <div className="mt-0.5 text-[10px] text-subtle">
                      {ago(n.createdAt)}
                    </div>
                  </>
                );
                const cls = "block px-3 py-2 hover:bg-[#F5F4EF]";
                const style = { borderTop: "0.5px solid var(--border)" };
                return n.entityType === "company" && n.entityId ? (
                  <Link
                    key={n.id}
                    href={`/company/${n.entityId}`}
                    className={cls}
                    style={style}
                    onClick={() => setOpen(false)}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className={cls} style={style}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
