"use client";

import { useState } from "react";
import { SignalSourceBadge } from "./SignalSourceBadge";
import { formatDate } from "@/lib/format";
import type { Signal } from "@/lib/types";

// A single key signal with full provenance: the LLM-extracted key quote up top,
// the source badge + name + outbound link, and (collapsed) the underlying source
// excerpt + why the extractor flagged it — so the signal is never a black box.
export function SignalCard({ signal }: { signal: Signal }) {
  const [open, setOpen] = useState(false);
  const hasMore = !!signal.rawExcerpt || !!signal.reasoning;

  return (
    <div
      className="rounded-lg bg-surface p-3"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{signal.title}</span>
        <span className="text-[11px] font-normal text-subtle">
          {formatDate(signal.ingestedAt)}
        </span>
      </div>

      <blockquote
        className="mt-2 rounded-r bg-[#F5F4EF] px-3 py-2 text-[12px] font-normal italic text-muted"
        style={{ borderLeft: "2px solid var(--border)" }}
      >
        {signal.excerpt}
      </blockquote>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SignalSourceBadge source={signal.sourceType} />
        {signal.sourceName && (
          <span className="text-[11px] font-normal text-subtle">{signal.sourceName}</span>
        )}
        <a
          href={signal.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-normal text-[#185FA5] hover:underline"
        >
          View source
        </a>
        {hasMore && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto text-[11px] font-normal text-muted hover:text-ink"
          >
            {open ? "Hide provenance" : "Show provenance"}
          </button>
        )}
      </div>

      {open && hasMore && (
        <div
          className="mt-2 space-y-2 border-t pt-2"
          style={{ borderColor: "var(--border)" }}
        >
          {signal.rawExcerpt && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-subtle">
                Source excerpt
              </div>
              <p className="mt-1 text-[12px] font-normal text-muted">
                {signal.rawExcerpt}
              </p>
            </div>
          )}
          {signal.reasoning && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-subtle">
                Why flagged
              </div>
              <p className="mt-1 text-[12px] font-normal text-muted">
                {signal.reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
