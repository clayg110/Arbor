"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTOR_LABELS } from "@/lib/colors";

const SECTORS = Object.entries(SECTOR_LABELS) as [string, string][];

const DEAL_TYPES = [
  {
    value: "carveout",
    label: "Carveouts",
    desc: "Corporate parents divesting a division",
  },
  {
    value: "private_asset",
    label: "Private assets",
    desc: "PE-backed companies approaching an exit",
  },
] as const;

type Step = 1 | 2 | 3;

export default function OnboardPage() {
  const [step, setStep] = useState<Step>(1);
  const [sectors, setSectors] = useState<Set<string>>(new Set());
  const [dealTypes, setDealTypes] = useState<Set<string>>(
    new Set(["carveout", "private_asset"])
  );
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function toggleSector(s: string) {
    setSectors((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function toggleDeal(d: string) {
    setDealTypes((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function finish() {
    setSaving(true);
    // Store selection locally so the radar page can pre-apply these filters.
    try {
      localStorage.setItem(
        "arbor.onboard",
        JSON.stringify({ sectors: Array.from(sectors), dealTypes: Array.from(dealTypes) })
      );
    } catch {
      // storage not available — no-op
    }
    // Build radar URL with filters pre-applied.
    const qs = new URLSearchParams();
    Array.from(sectors).forEach((s) => qs.append("sector", s));
    Array.from(dealTypes).forEach((d) => qs.append("deal", d));
    router.push(`/radar${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-surface shadow-lg"
        style={{ border: "0.5px solid var(--border)" }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-[var(--border)]">
          <div
            className="h-full bg-[#185FA5] transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="px-8 pb-8 pt-7">
          {step === 1 && (
            <StepOne
              sectors={sectors}
              onToggle={toggleSector}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepTwo
              dealTypes={dealTypes}
              onToggle={toggleDeal}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepThree
              sectors={sectors}
              dealTypes={dealTypes}
              saving={saving}
              onBack={() => setStep(2)}
              onFinish={finish}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepOne({
  sectors,
  onToggle,
  onNext,
}: {
  sectors: Set<string>;
  onToggle: (s: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
        Step 1 of 3
      </p>
      <h1 className="mt-1 text-[20px] font-medium text-ink">
        Which sectors do you cover?
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Pick any — you can change these in Settings.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {SECTORS.map(([key, label]) => {
          const active = sectors.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              aria-pressed={active}
              className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
              style={{
                border: "0.5px solid var(--border)",
                background: active ? "#185FA5" : "var(--surface)",
                color: active ? "#fff" : "var(--text-muted)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-7 flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg px-5 py-2 text-[13px] font-medium text-white"
          style={{ backgroundColor: "#185FA5" }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function StepTwo({
  dealTypes,
  onToggle,
  onBack,
  onNext,
}: {
  dealTypes: Set<string>;
  onToggle: (d: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
        Step 2 of 3
      </p>
      <h1 className="mt-1 text-[20px] font-medium text-ink">
        What deal types interest you?
      </h1>
      <p className="mt-1 text-[13px] text-muted">Both selected by default.</p>
      <div className="mt-5 space-y-3">
        {DEAL_TYPES.map((dt) => {
          const active = dealTypes.has(dt.value);
          return (
            <button
              key={dt.value}
              type="button"
              onClick={() => onToggle(dt.value)}
              aria-pressed={active}
              className="w-full rounded-xl px-4 py-3 text-left transition-colors"
              style={{
                border: `0.5px solid ${active ? "#185FA5" : "var(--border)"}`,
                background: active ? "#EBF4FF" : "var(--surface)",
              }}
            >
              <p
                className="text-[13px] font-medium"
                style={{ color: active ? "#0C447C" : "var(--text)" }}
              >
                {dt.label}
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {dt.desc}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-7 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-muted hover:text-ink"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg px-5 py-2 text-[13px] font-medium text-white"
          style={{ backgroundColor: "#185FA5" }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function StepThree({
  sectors,
  dealTypes,
  saving,
  onBack,
  onFinish,
}: {
  sectors: Set<string>;
  dealTypes: Set<string>;
  saving: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const sectorList = Array.from(sectors)
    .map((s) => SECTOR_LABELS[s as keyof typeof SECTOR_LABELS] ?? s)
    .join(", ");

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
        Step 3 of 3
      </p>
      <h1 className="mt-1 text-[20px] font-medium text-ink">You&apos;re all set</h1>
      <p className="mt-1 text-[13px] text-muted">
        Here&apos;s what Arbor will surface for you:
      </p>

      <div
        className="mt-5 space-y-3 rounded-xl p-4"
        style={{ background: "var(--bg)", border: "0.5px solid var(--border)" }}
      >
        <SummaryRow label="Sectors" value={sectorList || "All sectors"} />
        <SummaryRow
          label="Deal types"
          value={
            dealTypes.size === 2
              ? "Carveouts + Private assets"
              : dealTypes.has("carveout")
                ? "Carveouts only"
                : dealTypes.has("private_asset")
                  ? "Private assets only"
                  : "None selected"
          }
        />
      </div>

      <p className="mt-4 text-[11px] text-muted">
        You can refine these from the radar filter bar any time.
      </p>

      <div className="mt-7 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-muted hover:text-ink"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={saving}
          className="rounded-lg px-6 py-2 text-[13px] font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "#185FA5" }}
        >
          {saving ? "Saving…" : "Go to Radar →"}
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="text-right text-[12px] font-medium text-ink">{value}</span>
    </div>
  );
}
