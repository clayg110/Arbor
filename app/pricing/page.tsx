"use client";

import { useEffect, useState } from "react";
import { api, BackendOff } from "@/lib/api-client";
import { PLAN_DISPLAY, PLAN_FEATURES, type PlanDisplay } from "@/lib/usage";
import { COMPANY } from "@/lib/site";
import { cn } from "@/lib/format";

type Plan = "free" | "pro" | "enterprise";
const PLAN_ORDER: Plan[] = ["free", "pro", "enterprise"];

export default function PricingPage() {
  const [current, setCurrent] = useState<Plan>("free");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getPlan()
      .then((r) => setCurrent(r.plan))
      .catch(() => {
        // BackendOff (demo) — assume free
      });
  }, []);

  async function upgrade() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.billingCheckout("pro");
      if (r.url) window.location.href = r.url;
      else setMsg("Billing isn't configured on this deployment.");
    } catch (e) {
      setMsg(
        e instanceof BackendOff
          ? "Upgrade is unavailable in demo mode."
          : "Could not start checkout."
      );
    } finally {
      setBusy(false);
    }
  }

  async function manageBilling() {
    setMsg(null);
    try {
      const r = await api.billingPortal();
      if (r.url) window.location.href = r.url;
      else setMsg("Billing isn't configured on this deployment.");
    } catch (e) {
      setMsg(
        e instanceof BackendOff
          ? "Billing management is unavailable in demo mode."
          : "Could not open the billing portal."
      );
    }
  }

  const currentIdx = PLAN_ORDER.indexOf(current);

  return (
    <div className="mx-auto max-w-[920px]">
      <div className="mb-6">
        <h1 className="text-[20px] font-medium text-ink">Plans &amp; pricing</h1>
        <p className="mt-1 text-[13px] text-muted">
          Start free and scale as your deal flow grows. You&apos;re currently on the{" "}
          <span className="font-medium text-ink">{PLAN_DISPLAY[current].label}</span>{" "}
          plan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((plan, i) => (
          <PlanCard
            key={plan}
            plan={plan}
            display={PLAN_DISPLAY[plan]}
            features={PLAN_FEATURES[plan]}
            highlight={plan === "pro"}
            state={i === currentIdx ? "current" : i > currentIdx ? "upgrade" : "included"}
            busy={busy}
            onUpgrade={upgrade}
          />
        ))}
      </div>

      {current !== "free" && (
        <div className="mt-5">
          <button
            type="button"
            onClick={manageBilling}
            className="text-[12px] font-medium text-[#185FA5] hover:underline"
          >
            Manage billing →
          </button>
        </div>
      )}
      {msg && <p className="mt-3 text-[12px] text-muted">{msg}</p>}

      <p className="mt-6 text-[12px] text-subtle">
        All plans include SOC 2-aligned data handling and row-level tenant isolation. Need
        something custom? Email {COMPANY.contactEmail}.
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  display,
  features,
  highlight,
  state,
  busy,
  onUpgrade,
}: {
  plan: Plan;
  display: PlanDisplay;
  features: string[];
  highlight: boolean;
  state: "current" | "upgrade" | "included";
  busy: boolean;
  onUpgrade: () => void;
}) {
  return (
    <section
      className="relative flex flex-col rounded-xl bg-surface p-5"
      style={{
        border: highlight ? "1px solid #185FA5" : "0.5px solid var(--border)",
      }}
    >
      {highlight && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-[#185FA5] px-2 py-0.5 text-[10px] font-medium text-white">
          Most popular
        </span>
      )}
      <h2 className="text-[14px] font-medium text-ink">{display.label}</h2>
      <p className="mt-0.5 text-[12px] text-muted">{display.blurb}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-[26px] font-medium text-ink">{display.price}</span>
        {display.cadence && (
          <span className="text-[12px] text-muted">{display.cadence}</span>
        )}
      </div>

      <ul className="mt-4 flex-1 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-[12px] text-muted">
            <span
              className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#157A5A]"
              aria-hidden
            />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {state === "current" ? (
          <span
            className="block rounded-md px-3 py-2 text-center text-[12px] font-medium text-[#0C447C]"
            style={{ backgroundColor: "#E6F1FB" }}
          >
            Your plan
          </span>
        ) : state === "included" ? (
          <span className="block px-3 py-2 text-center text-[12px] text-subtle">
            Included
          </span>
        ) : plan === "enterprise" ? (
          <a
            href={`mailto:${COMPANY.contactEmail}?subject=Arbor%20Enterprise`}
            className="block rounded-md px-3 py-2 text-center text-[12px] font-medium text-white"
            style={{ backgroundColor: "#185FA5" }}
          >
            Contact sales
          </a>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            disabled={busy}
            className={cn(
              "block w-full rounded-md px-3 py-2 text-center text-[12px] font-medium text-white disabled:opacity-50"
            )}
            style={{ backgroundColor: "#185FA5" }}
          >
            {busy ? "Starting…" : `Upgrade to ${display.label}`}
          </button>
        )}
      </div>
    </section>
  );
}
