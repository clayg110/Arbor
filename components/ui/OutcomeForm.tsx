"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";

interface Props {
  companyId: string;
  outcome: "closed" | "withdrawn" | null;
  acquirer: string | null;
  closeMultiple: string | null;
  closedAt: string | null;
}

const OUTCOME_LABELS: Record<"closed" | "withdrawn", string> = {
  closed: "Closed",
  withdrawn: "Withdrawn",
};

const OUTCOME_COLORS: Record<"closed" | "withdrawn", string> = {
  closed: "#157A5A",
  withdrawn: "#C0322F",
};

export function OutcomeForm({
  companyId,
  outcome: initialOutcome,
  acquirer: initialAcquirer,
  closeMultiple: initialMultiple,
  closedAt: initialClosedAt,
}: Props) {
  const [outcome, setOutcome] = useState<"closed" | "withdrawn" | "">(
    initialOutcome ?? ""
  );
  const [acquirer, setAcquirer] = useState(initialAcquirer ?? "");
  const [closeMultiple, setCloseMultiple] = useState(initialMultiple ?? "");
  const [closedAt, setClosedAt] = useState(
    initialClosedAt ? initialClosedAt.slice(0, 10) : ""
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const current = initialOutcome;

  async function handleSave() {
    setSaving(true);
    try {
      await api.setOutcome(companyId, {
        outcome: outcome || null,
        acquirer: acquirer || null,
        closeMultiple: closeMultiple || null,
        closedAt: closedAt || null,
      });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // leave editing open on error
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-normal text-subtle">Outcome</span>
        <div className="flex items-center gap-2">
          {current ? (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: OUTCOME_COLORS[current] }}
            >
              {OUTCOME_LABELS[current]}
            </span>
          ) : (
            <span className="font-normal text-subtle">—</span>
          )}
          {saved && <span className="text-[11px] font-normal text-[#157A5A]">Saved</span>}
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSaved(false);
            }}
            className="rounded px-1.5 py-0.5 text-[11px] font-normal text-muted hover:bg-[#F1EFE8] hover:text-ink"
          >
            {current ? "Edit" : "Set"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-2.5 rounded-md bg-[#F5F4EF] p-3"
      role="form"
      aria-label="Set deal outcome"
    >
      <fieldset>
        <legend className="mb-1.5 text-[11px] font-medium text-ink">Outcome</legend>
        <div className="flex gap-3">
          {(["closed", "withdrawn", ""] as const).map((v) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-1.5 text-[12px] font-normal text-muted"
            >
              <input
                type="radio"
                name={`outcome-${companyId}`}
                value={v}
                checked={outcome === v}
                onChange={() => setOutcome(v)}
                className="accent-[#185FA5]"
              />
              {v === "" ? "None" : OUTCOME_LABELS[v]}
            </label>
          ))}
        </div>
      </fieldset>

      {outcome === "closed" && (
        <>
          <div>
            <label
              className="mb-1 block text-[11px] font-normal text-subtle"
              htmlFor={`acquirer-${companyId}`}
            >
              Acquirer
            </label>
            <input
              id={`acquirer-${companyId}`}
              type="text"
              value={acquirer}
              onChange={(e) => setAcquirer(e.target.value)}
              placeholder="Buyer name"
              maxLength={200}
              className="w-full rounded border border-[var(--border)] bg-surface px-2 py-1 text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                className="mb-1 block text-[11px] font-normal text-subtle"
                htmlFor={`multiple-${companyId}`}
              >
                Exit multiple
              </label>
              <input
                id={`multiple-${companyId}`}
                type="text"
                value={closeMultiple}
                onChange={(e) => setCloseMultiple(e.target.value)}
                placeholder="12.5x EBITDA"
                maxLength={50}
                className="w-full rounded border border-[var(--border)] bg-surface px-2 py-1 text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-[11px] font-normal text-subtle"
                htmlFor={`closedat-${companyId}`}
              >
                Close date
              </label>
              <input
                id={`closedat-${companyId}`}
                type="date"
                value={closedAt}
                onChange={(e) => setClosedAt(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-surface px-2 py-1 text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
              />
            </div>
          </div>
        </>
      )}

      {outcome === "withdrawn" && (
        <div>
          <label
            className="mb-1 block text-[11px] font-normal text-subtle"
            htmlFor={`withdrawnat-${companyId}`}
          >
            Withdrawn date
          </label>
          <input
            id={`withdrawnat-${companyId}`}
            type="date"
            value={closedAt}
            onChange={(e) => setClosedAt(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-surface px-2 py-1 text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded px-3 py-1 text-[12px] font-normal text-muted hover:bg-[#EFEDE6]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-[#185FA5] px-3 py-1 text-[12px] font-medium text-white disabled:opacity-60 hover:bg-[#1454903]"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
