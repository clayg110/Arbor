"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

interface Cmd {
  id: string;
  label: string;
  sublabel?: string;
  action: () => void;
  icon?: string;
}

const NAV_COMMANDS: Omit<Cmd, "action">[] = [
  { id: "nav-radar", label: "Radar", sublabel: "Deal pipeline board", icon: "⬡" },
  { id: "nav-feed", label: "Feed", sublabel: "Live signal stream", icon: "≡" },
  {
    id: "nav-analytics",
    label: "Analytics",
    sublabel: "Sector & sponsor metrics",
    icon: "▲",
  },
  {
    id: "nav-watchlist",
    label: "Watchlist",
    sublabel: "Your tracked companies",
    icon: "★",
  },
  { id: "nav-settings", label: "Settings", sublabel: "Preferences & alerts", icon: "⚙" },
  { id: "nav-docs", label: "API Docs", sublabel: "Public API reference", icon: "⊞" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Cmd[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  function close() {
    setOpen(false);
    setQuery("");
    setSearchResults([]);
    setActiveIdx(0);
  }

  const buildNavCmds = useCallback(
    () =>
      NAV_COMMANDS.map((c) => ({
        ...c,
        action: () => {
          router.push(`/${c.id.replace("nav-", "")}`);
          close();
        },
      })),
    [router]
  );

  // Debounced company search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setActiveIdx(0);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.search(query);
        const cmds: Cmd[] = res.hits.slice(0, 6).map((h) => ({
          id: `company-${h.document.id}`,
          label: h.document.name,
          sublabel: `${h.document.sector} · ${h.document.currentStage ?? h.document.dealType}`,
          icon: "◎",
          action: () => {
            router.push(`/company/${h.document.id}`);
            close();
          },
        }));
        setSearchResults(cmds);
        setActiveIdx(0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const allCmds = query.trim() ? searchResults : buildNavCmds();

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, allCmds.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      allCmds[activeIdx]?.action();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette (⌘K)"
        className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted hover:text-ink md:flex"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <span className="text-subtle">⌘K</span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        className="w-full max-w-[520px] overflow-hidden rounded-xl bg-surface shadow-2xl"
        style={{ border: "0.5px solid var(--border)" }}
        onKeyDown={onKeyDown}
      >
        {/* Input */}
        <div
          className="flex items-center gap-2 px-4"
          style={{ borderBottom: "0.5px solid var(--border)" }}
        >
          <span className="text-muted" aria-hidden>
            {searching ? "⟳" : "⌕"}
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={allCmds.length > 0}
            aria-controls="cmd-list"
            aria-activedescendant={
              allCmds[activeIdx] ? `cmd-${allCmds[activeIdx].id}` : undefined
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies or jump to…"
            className="w-full bg-transparent py-3.5 text-[14px] text-ink placeholder:text-subtle focus:outline-none"
          />
          <kbd
            className="hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted sm:block"
            style={{ border: "0.5px solid var(--border)" }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <ul
          id="cmd-list"
          ref={listRef}
          role="listbox"
          className="max-h-[320px] overflow-y-auto py-1.5"
        >
          {allCmds.length === 0 && query.trim() && !searching && (
            <li className="px-4 py-3 text-[13px] text-muted">
              No results for &ldquo;{query}&rdquo;
            </li>
          )}
          {allCmds.map((cmd, idx) => (
            <li
              key={cmd.id}
              id={`cmd-${cmd.id}`}
              role="option"
              aria-selected={idx === activeIdx}
              onClick={cmd.action}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`flex cursor-default items-center gap-3 px-4 py-2.5 ${
                idx === activeIdx ? "bg-[#F1EFE8] dark:bg-[#252523]" : ""
              }`}
            >
              <span
                className="w-4 shrink-0 text-center text-[14px] text-muted"
                aria-hidden
              >
                {cmd.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">{cmd.label}</p>
                {cmd.sublabel && (
                  <p className="truncate text-[11px] text-muted">{cmd.sublabel}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Footer hint */}
        {!query && (
          <div
            className="flex items-center gap-3 px-4 py-2 text-[10px] text-subtle"
            style={{ borderTop: "0.5px solid var(--border)" }}
          >
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
