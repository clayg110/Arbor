"use client";

import { useState, useEffect } from "react";
import { api, BackendOff } from "@/lib/api-client";
import {
  BID_TYPE_LABELS,
  BID_ROUND_LABELS,
  bidSummary,
  avgMultiple,
  type Bid,
  type BidType,
  type BidRound,
} from "@/lib/bids";

interface Props {
  companyId: string;
  fallback?: Bid[];
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const BID_TYPES: BidType[] = ["indicative", "final"];
const BID_ROUNDS: BidRound[] = ["1", "2", "final"];

export function BidTrackerSection({ companyId, fallback = [] }: Props) {
  const [bids, setBids] = useState<Bid[]>(fallback);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backendOff, setBackendOff] = useState(false);

  // form state
  const [bidType, setBidType] = useState<BidType>("indicative");
  const [round, setRound] = useState<BidRound>("1");
  const [bidDate, setBidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountUsd, setAmountUsd] = useState("");
  const [multipleOnEbitda, setMultipleOnEbitda] = useState("");
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    api
      .listBids(companyId)
      .then((r) => setBids(r.bids))
      .catch((e) => {
        if (e instanceof BackendOff) setBackendOff(true);
      });
  }, [companyId]);

  const avg = avgMultiple(bids);

  function resetForm() {
    setBidType("indicative");
    setRound("1");
    setBidDate(new Date().toISOString().slice(0, 10));
    setAmountUsd("");
    setMultipleOnEbitda("");
    setRationale("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.recordBid(companyId, {
        bidType,
        round,
        bidDate,
        amountUsd: amountUsd ? parseFloat(amountUsd) : null,
        multipleOnEbitda: multipleOnEbitda ? parseFloat(multipleOnEbitda) : null,
        rationale: rationale.trim() || null,
      });
      setBids((prev) => [result.bid, ...prev]);
      setShowForm(false);
      resetForm();
    } catch {
      // no-op — backend errors bubble silently; user can retry
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bidId: string) {
    try {
      await api.deleteBid(companyId, bidId);
      setBids((prev) => prev.filter((b) => b.id !== bidId));
    } catch {
      // no-op
    }
  }

  if (backendOff) {
    return <p className="text-[12px] text-subtle">Bid tracking requires live mode.</p>;
  }

  return (
    <div className="space-y-3">
      {/* summary strip */}
      {bids.length > 0 && (
        <div className="flex flex-wrap gap-3 text-[12px]">
          <span className="text-subtle">
            {bids.length} bid{bids.length !== 1 ? "s" : ""} recorded
          </span>
          {avg !== null && (
            <span className="font-medium text-ink">Avg {avg.toFixed(1)}x EBITDA</span>
          )}
        </div>
      )}

      {/* bid list */}
      {bids.length > 0 && (
        <ul className="space-y-2">
          {bids.map((bid) => (
            <li
              key={bid.id}
              className="rounded-md border border-[var(--border)] bg-[#FAFAF8] p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-medium text-ink">{bidSummary(bid)}</p>
                  <p className="text-[11px] text-subtle">{formatDate(bid.bidDate)}</p>
                  {bid.rationale && (
                    <p className="mt-1 text-[11px] text-muted">{bid.rationale}</p>
                  )}
                </div>
                <button
                  onClick={() => void handleDelete(bid.id)}
                  aria-label="Delete bid"
                  className="shrink-0 text-[11px] text-subtle hover:text-[#C0322F]"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {bids.length === 0 && !showForm && (
        <p className="text-[12px] text-subtle">No bids recorded yet.</p>
      )}

      {/* form */}
      {showForm ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-subtle" htmlFor="bid-type">
                Type
              </label>
              <select
                id="bid-type"
                value={bidType}
                onChange={(e) => setBidType(e.target.value as BidType)}
                className="w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] text-ink"
              >
                {BID_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BID_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-subtle" htmlFor="bid-round">
                Round
              </label>
              <select
                id="bid-round"
                value={round}
                onChange={(e) => setRound(e.target.value as BidRound)}
                className="w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] text-ink"
              >
                {BID_ROUNDS.map((r) => (
                  <option key={r} value={r}>
                    {BID_ROUND_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-subtle" htmlFor="bid-date">
              Bid date
            </label>
            <input
              id="bid-date"
              type="date"
              required
              value={bidDate}
              onChange={(e) => setBidDate(e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-subtle" htmlFor="bid-amount">
                Amount ($M, optional)
              </label>
              <input
                id="bid-amount"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 420"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] text-ink"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-[11px] text-subtle"
                htmlFor="bid-multiple"
              >
                EBITDA multiple (optional)
              </label>
              <input
                id="bid-multiple"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 11.2"
                value={multipleOnEbitda}
                onChange={(e) => setMultipleOnEbitda(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] text-ink"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-subtle" htmlFor="bid-rationale">
              Rationale (optional)
            </label>
            <textarea
              id="bid-rationale"
              rows={2}
              maxLength={1000}
              placeholder="Why this price?"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] text-ink"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !bidDate}
              className="rounded bg-[#185FA5] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save bid"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="text-[12px] text-subtle hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-[12px] font-medium text-[#185FA5] hover:underline"
        >
          + Record bid
        </button>
      )}
    </div>
  );
}
