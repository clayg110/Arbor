"use client";

import { useState } from "react";
import { api, BackendOff } from "@/lib/api-client";
import { Modal } from "./primitives/Modal";
import { Button } from "./primitives/Button";
import { Field, Input, Select } from "./primitives/Field";
import { useToast } from "./primitives/Toast";
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
  const toast = useToast();

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
        toast(`${company.name} added to radar`);
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
    toast(`${name.trim()} added to radar`);
    onClose();
  }

  return (
    <Modal title="Add company" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Company name" htmlFor="ac-name" className="mb-4">
          <Input
            id="ac-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Deal type">
            <Select
              aria-label="Deal type"
              value={dealType}
              onChange={(e) => setDealType(e.target.value as DealType)}
            >
              {(["carveout", "private_asset"] as DealType[]).map((d) => (
                <option key={d} value={d}>
                  {DEAL_TYPE_LABELS[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sector">
            <Select
              aria-label="Sector"
              value={sector}
              onChange={(e) => setSector(e.target.value as Sector)}
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {SECTOR_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={ownerLabel} className="mt-3">
          <Input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Stage">
            <Select
              aria-label="Stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Confidence">
            <Select
              aria-label="Confidence"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as Confidence)}
            >
              {CONFS.map((c) => (
                <option key={c} value={c}>
                  {CONFIDENCE_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {error && <p className="mt-3 text-[12px] text-[#791F1F]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {busy ? "Adding…" : "Add company"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
