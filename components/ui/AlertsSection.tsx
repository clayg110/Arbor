"use client";

import { useEffect, useState } from "react";
import { api, BackendOff } from "@/lib/api-client";
import { describeRule, type AlertRule, type AlertPredicate } from "@/lib/alert-rules";
import { SECTORS, SECTOR_LABELS, STAGE_LABELS, CONFIDENCE_LABELS } from "@/lib/colors";
import { XIcon } from "./icons";
import type { Sector, DealType, Stage, Confidence } from "@/lib/types";

const STAGES: Stage[] = ["in_market", "monitor_for_exit", "on_hold", "pulled"];
const CONFS: Confidence[] = ["high", "medium", "low", "needs_review"];

export function AlertsCard() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api
      .listAlerts()
      .then((r) => {
        setRules(r.rules);
        setState("ready");
      })
      .catch((e) => setState(e instanceof BackendOff ? "offline" : "ready"));
  }, []);

  async function remove(id: string) {
    const prev = rules;
    setRules((rs) => rs.filter((r) => r.id !== id));
    try {
      await api.deleteAlert(id);
    } catch {
      setRules(prev);
    }
  }

  async function toggle(rule: AlertRule) {
    const next = !rule.active;
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, active: next } : r)));
    try {
      await api.updateAlert(rule.id, { active: next });
    } catch {
      setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, active: !next } : r)));
    }
  }

  return (
    <section
      className="mb-4 rounded-lg bg-surface p-5"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-medium text-ink">Alerts</h2>
          <p className="mb-1 mt-1 text-[12px] text-muted">
            Get notified when a deal matches your criteria (sector, sponsor, stage,
            conviction). Delivered in-app; opt in to a webhook too.
          </p>
        </div>
        {state === "ready" && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white"
            style={{ backgroundColor: "#185FA5" }}
          >
            {showForm ? "Cancel" : "New alert"}
          </button>
        )}
      </div>

      {state === "offline" && (
        <p className="text-[12px] text-muted">
          Alerts are available with a connected backend.
        </p>
      )}

      {showForm && (
        <NewAlertForm
          onCreated={(rule) => {
            setRules((rs) => [rule, ...rs]);
            setShowForm(false);
          }}
        />
      )}

      {state === "ready" && rules.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
              style={{ border: "0.5px solid var(--border)" }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">
                    {r.name}
                  </span>
                  {!r.active && (
                    <span className="rounded-full bg-[#EDEBE4] px-1.5 py-0.5 text-[10px] font-medium text-[#555550]">
                      Paused
                    </span>
                  )}
                  {r.webhook && (
                    <span className="rounded-full bg-[#E6F1FB] px-1.5 py-0.5 text-[10px] font-medium text-[#0C447C]">
                      Webhook
                    </span>
                  )}
                  {r.emailDelivery && (
                    <span className="rounded-full bg-[#FAEEDA] px-1.5 py-0.5 text-[10px] font-medium text-[#7A4A00]">
                      Email
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-muted">
                  {describeRule(r.predicate)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  className="text-[11px] font-medium text-muted hover:text-ink"
                >
                  {r.active ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  aria-label={`Delete alert ${r.name}`}
                  className="text-subtle hover:text-[#791F1F]"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {state === "ready" && rules.length === 0 && !showForm && (
        <p className="mt-2 text-[12px] text-subtle">No alerts yet.</p>
      )}
    </section>
  );
}

export interface NewAlertInitial {
  name?: string;
  sector?: string;
  dealType?: string;
  sponsorContains?: string;
  nameContains?: string;
  stageEnters?: string;
  minConfidence?: string;
  minConviction?: number;
}

export function NewAlertForm({
  onCreated,
  onCancel,
  initial = {},
}: {
  onCreated: (rule: AlertRule) => void;
  onCancel?: () => void;
  initial?: NewAlertInitial;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [sector, setSector] = useState<Sector | "">((initial.sector as Sector) ?? "");
  const [dealType, setDealType] = useState<DealType | "">(
    (initial.dealType as DealType) ?? ""
  );
  const [stageEnters, setStageEnters] = useState<Stage | "">(
    (initial.stageEnters as Stage) ?? ""
  );
  const [minConfidence, setMinConfidence] = useState<Confidence | "">(
    (initial.minConfidence as Confidence) ?? ""
  );
  const [minConviction, setMinConviction] = useState(
    initial.minConviction != null ? String(initial.minConviction) : ""
  );
  const [sponsorContains, setSponsorContains] = useState(initial.sponsorContains ?? "");
  const [nameContains, setNameContains] = useState(initial.nameContains ?? "");
  const [webhook, setWebhook] = useState(false);
  const [emailDelivery, setEmailDelivery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    setError(null);
    const predicate: AlertPredicate = {};
    if (sector) predicate.sector = sector;
    if (dealType) predicate.dealType = dealType;
    if (stageEnters) predicate.stageEnters = stageEnters;
    if (minConfidence) predicate.minConfidence = minConfidence;
    if (minConviction) predicate.minConviction = Number(minConviction);
    if (sponsorContains.trim()) predicate.sponsorContains = sponsorContains.trim();
    if (nameContains.trim()) predicate.nameContains = nameContains.trim();
    try {
      const { rule } = await api.createAlert({
        name: name.trim(),
        predicate,
        webhook,
        emailDelivery,
      });
      onCreated(rule);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create alert.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 space-y-3 rounded-md p-3"
      style={{ border: "0.5px solid var(--border)", backgroundColor: "#FAF9F6" }}
    >
      <Field label="Alert name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chemicals carveouts entering market"
          aria-label="Alert name"
          className="w-full rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-ink focus:outline-none focus-ring"
          style={{ border: "0.5px solid var(--border)" }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sector">
          <Picker
            label="Sector"
            value={sector}
            onChange={(v) => setSector(v as Sector | "")}
          >
            <option value="">Any sector</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </Picker>
        </Field>
        <Field label="Deal type">
          <Picker
            label="Deal type"
            value={dealType}
            onChange={(v) => setDealType(v as DealType | "")}
          >
            <option value="">Any type</option>
            <option value="carveout">Carveout</option>
            <option value="private_asset">Private asset</option>
          </Picker>
        </Field>
        <Field label="Enters stage">
          <Picker
            label="Enters stage"
            value={stageEnters}
            onChange={(v) => setStageEnters(v as Stage | "")}
          >
            <option value="">Any stage</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </Picker>
        </Field>
        <Field label="Min. confidence">
          <Picker
            label="Minimum confidence"
            value={minConfidence}
            onChange={(v) => setMinConfidence(v as Confidence | "")}
          >
            <option value="">Any confidence</option>
            {CONFS.map((c) => (
              <option key={c} value={c}>
                {CONFIDENCE_LABELS[c]}
              </option>
            ))}
          </Picker>
        </Field>
        <Field label="Min. conviction (0–100)">
          <input
            type="number"
            min={0}
            max={100}
            value={minConviction}
            onChange={(e) => setMinConviction(e.target.value)}
            placeholder="Any"
            aria-label="Minimum conviction"
            className="w-full rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-ink focus:outline-none focus-ring"
            style={{ border: "0.5px solid var(--border)" }}
          />
        </Field>
        <Field label="Sponsor contains">
          <input
            value={sponsorContains}
            onChange={(e) => setSponsorContains(e.target.value)}
            placeholder="e.g. Carlyle"
            aria-label="Sponsor contains"
            className="w-full rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-ink focus:outline-none focus-ring"
            style={{ border: "0.5px solid var(--border)" }}
          />
        </Field>
        <Field label="Name contains">
          <input
            value={nameContains}
            onChange={(e) => setNameContains(e.target.value)}
            placeholder="e.g. Dow"
            aria-label="Company name contains"
            className="w-full rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-ink focus:outline-none focus-ring"
            style={{ border: "0.5px solid var(--border)" }}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={webhook}
            onChange={(e) => setWebhook(e.target.checked)}
          />
          Also send to the configured webhook
        </label>
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={emailDelivery}
            onChange={(e) => setEmailDelivery(e.target.checked)}
          />
          Also send an email per match (requires Resend)
        </label>
      </div>

      {error && <p className="text-[12px] text-[#791F1F]">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[12px] font-normal text-muted hover:text-ink"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          {busy ? "Creating…" : "Create alert"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-normal text-subtle">{label}</label>
      {children}
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md bg-surface px-2 py-1.5 text-[12px] text-ink focus:outline-none focus-ring"
      style={{ border: "0.5px solid var(--border)" }}
    >
      {children}
    </select>
  );
}
