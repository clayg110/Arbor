"use client";

import { useEffect, useState } from "react";
import { SignalSourceBadge } from "./SignalSourceBadge";
import { formatDate } from "@/lib/format";
import { api, BackendOff } from "@/lib/api-client";
import {
  netLabel,
  type FeedbackAggregate,
  type FeedbackVote,
} from "@/lib/signal-feedback";
import type { Signal } from "@/lib/types";

const EMPTY_AGG: FeedbackAggregate = { up: 0, down: 0, net: 0, total: 0 };

function applyVote(
  agg: FeedbackAggregate,
  oldV: FeedbackVote | null,
  newV: FeedbackVote | null
): FeedbackAggregate {
  let { up, down } = agg;
  if (oldV === "up") up -= 1;
  if (oldV === "down") down -= 1;
  if (newV === "up") up += 1;
  if (newV === "down") down += 1;
  return { up, down, net: up - down, total: up + down };
}

// A single key signal with full provenance: the LLM-extracted key quote up top,
// the source badge + name + outbound link, and (collapsed) the underlying source
// excerpt + why the extractor flagged it — so the signal is never a black box.
// Analysts thumbs-up/down to confirm or dispute the extraction.
export function SignalCard({ signal }: { signal: Signal }) {
  const [open, setOpen] = useState(false);
  const hasMore = !!signal.rawExcerpt || !!signal.reasoning;

  const [agg, setAgg] = useState<FeedbackAggregate>(EMPTY_AGG);
  const [myVote, setMyVote] = useState<FeedbackVote | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getSignalFeedback(signal.id)
      .then((r) => {
        if (!live) return;
        setAgg(r.aggregate);
        setMyVote(r.myVote);
      })
      .catch(() => {
        // BackendOff (mock) or error — start from an empty tally, votes stay local
      });
    return () => {
      live = false;
    };
  }, [signal.id]);

  function vote(v: FeedbackVote) {
    const next = myVote === v ? null : v;
    const prevVote = myVote;
    const prevAgg = agg;
    // optimistic
    setAgg(applyVote(agg, myVote, next));
    setMyVote(next);
    api.voteSignal(signal.id, next).then(
      (r) => {
        setAgg(r.aggregate);
        setMyVote(r.myVote);
      },
      (e) => {
        if (e instanceof BackendOff) return; // mock mode — keep optimistic
        setAgg(prevAgg); // real failure — revert
        setMyVote(prevVote);
      }
    );
  }

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
        {/* analyst feedback */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => vote("up")}
            aria-label="Mark this signal accurate"
            aria-pressed={myVote === "up"}
            className="rounded px-1 text-[12px] hover:text-ink"
            style={{ color: myVote === "up" ? "#157A5A" : "var(--text-subtle)" }}
          >
            ▲
          </button>
          {agg.total > 0 && (
            <span className="min-w-[14px] text-center text-[11px] font-medium text-muted">
              {netLabel(agg)}
            </span>
          )}
          <button
            type="button"
            onClick={() => vote("down")}
            aria-label="Mark this signal inaccurate"
            aria-pressed={myVote === "down"}
            className="rounded px-1 text-[12px] hover:text-ink"
            style={{ color: myVote === "down" ? "#C0322F" : "var(--text-subtle)" }}
          >
            ▼
          </button>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-[11px] font-normal text-muted hover:text-ink"
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
