"use client";

import { useRef, useState } from "react";
import { api, BackendOff } from "@/lib/api-client";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { XIcon } from "./icons";
import {
  SECTORS,
  SECTOR_LABELS,
  STAGE_LABELS,
  CONFIDENCE_LABELS,
  DEAL_TYPE_LABELS,
} from "@/lib/colors";
import { formatDate } from "@/lib/format";
import type { RadarCompany } from "@/lib/radar-data";
import type { Sector, DealType, Stage, Confidence } from "@/lib/types";

const STAGES: Stage[] = ["in_market", "monitor_for_exit", "on_hold", "pulled"];
const CONFS: Confidence[] = ["high", "medium", "low", "needs_review"];

export function AddCompanyModal({
  live,
  onClose,
  onAdded,
}: {
  live: boolean;
  onClose: () => void;
  onAdded: (c: RadarCompany) => void;
}) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState<Sector>("chemicals");
  const [dealType, setDealType] = useState<DealType>("carveout");
  const [owner, setOwner] = useState("");
  const [stage, setStage] = useState<Stage>("in_market");
  const [confidence, setConfidence] = useState<Confidence>("needs_review");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useFocusTrap(dialogRef, onClose);

  const ownerLabel = dealType === "carveout" ? "Parent company" : "Sponsor firm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Company name is required.");
    setBusy(true);

    const payload = {
      name: name.trim(),
      sector,
      dealType,
      sponsorFirm: dealType === "private_asset" ? owner : null,
      parentCompany: dealType === "carveout" ? owner : null,
      stage,
      confidence,
    };

    if (live) {
      try {
        const { company } = await api.createCompany(payload);
        onAdded(company);
        onClose();
        return;
      } catch (err) {
        if (!(err instanceof BackendOff)) {
          setError(err instanceof Error ? err.message : "Failed to add company");
          setBusy(false);
          return;
        }
      }
    }

    // mock mode (or backend off) → optimistic local card
    const id = `local-${Date.now()}`;
    onAdded({
      id,
      companyId: id,
      name: name.trim(),
      dealType,
      sector,
      confidence,
      stage,
      ownerName: owner.trim() || "Undisclosed",
      days: 0,
      added: new Date().toISOString(),
      addedDisplay: formatDate(new Date().toISOString()),
      lastSignal: {
        label: "just added",
        sourceName: "Manual",
        source: "manual",
        daysAgo: 0,
      },
      watchlisted: undefined,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add company"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-surface p-5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-ink">Add company</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-subtle hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <Label>Company name</Label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
          style={{ border: "0.5px solid var(--border)" }}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Deal type</Label>
            <Select
              label="Deal type"
              value={dealType}
              onChange={(v) => setDealType(v as DealType)}
            >
              {(["carveout", "private_asset"] as DealType[]).map((d) => (
                <option key={d} value={d}>
                  {DEAL_TYPE_LABELS[d]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Sector</Label>
            <Select
              label="Sector"
              value={sector}
              onChange={(v) => setSector(v as Sector)}
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {SECTOR_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-3">
          <Label>{ownerLabel}</Label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Optional"
            className="mb-1 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-subtle focus:outline-none"
            style={{ border: "0.5px solid var(--border)" }}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Label>Stage</Label>
            <Select label="Stage" value={stage} onChange={(v) => setStage(v as Stage)}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Confidence</Label>
            <Select
              label="Confidence"
              value={confidence}
              onChange={(v) => setConfidence(v as Confidence)}
            >
              {CONFS.map((c) => (
                <option key={c} value={c}>
                  {CONFIDENCE_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error && <p className="mt-3 text-[12px] text-[#791F1F]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
            style={{ border: "0.5px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#185FA5" }}
          >
            {busy ? "Adding…" : "Add company"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-normal text-muted">{children}</label>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md bg-surface px-2.5 py-2 text-[13px] text-ink focus:outline-none"
      style={{ border: "0.5px solid var(--border)" }}
    >
      {children}
    </select>
  );
}
