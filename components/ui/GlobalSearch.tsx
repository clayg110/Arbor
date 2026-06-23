"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "./icons";
import { StageBadge } from "./StageBadge";
import { SECTOR_LABELS } from "@/lib/colors";
import { api } from "@/lib/api-client";
import type { Sector, Stage } from "@/lib/types";

interface Hit {
  id: string;
  name: string;
  sector: string;
  currentStage: string;
  owner: string;
}

// Header search across all companies (server-side via /api/search — Typesense
// or the Supabase ilike fallback). No-op in mock mode (503 → empty).
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // debounced search
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.search(query);
        if (!cancelled) {
          setHits(res.hits.map((h) => h.document));
          setActive(0);
          setOpen(true);
        }
      } catch {
        if (!cancelled) setHits([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  // close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(h: Hit) {
    setOpen(false);
    setQ("");
    router.push(`/company/${h.id}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) go(hit);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div
        className="flex items-center gap-1.5 rounded-md bg-bg px-2.5 py-1.5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <SearchIcon className="h-3.5 w-3.5 text-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search companies…"
          className="w-40 bg-transparent text-[12px] font-normal text-ink placeholder:text-subtle focus:outline-none focus-ring sm:w-56"
        />
      </div>

      {open && hits.length > 0 && (
        <div
          className="absolute right-0 z-30 mt-1 max-h-80 w-80 overflow-y-auto rounded-lg bg-surface py-1 shadow-lg"
          style={{ border: "0.5px solid var(--border)" }}
        >
          {hits.map((h, i) => (
            <button
              key={h.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(h)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
              style={{ backgroundColor: i === active ? "#F5F4EF" : undefined }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-ink">{h.name}</div>
                <div className="truncate text-[11px] font-normal text-muted">
                  {SECTOR_LABELS[h.sector as Sector] ?? h.sector} · {h.owner}
                </div>
              </div>
              <StageBadge stage={h.currentStage as Stage} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
