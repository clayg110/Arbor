"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api, BackendOff } from "@/lib/api-client";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { TwoFactorSection } from "@/components/ui/TwoFactorSection";
import { AlertsCard } from "@/components/ui/AlertsSection";
import { SettingsIcon, XIcon } from "@/components/ui/icons";
import {
  buildUsageMeters,
  planQuota,
  nextPlan,
  quotaLabel,
  type UsageMeter,
} from "@/lib/usage";
import type { Plan } from "@/lib/billing";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[680px]">
      <div className="mb-6 flex items-center gap-2">
        <SettingsIcon className="h-[18px] w-[18px] text-muted" />
        <h1 className="text-[18px] font-medium text-ink">Account &amp; privacy</h1>
      </div>

      <PlanCard />
      <TwoFactorSection />
      <AlertsCard />
      <BriefingCard />
      <ReportCard />
      <CalendarCard />
      <ExportCard />
      <DangerCard />
    </div>
  );
}

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-4 rounded-lg bg-surface p-5"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <h2 className="text-[14px] font-medium text-ink">{title}</h2>
      <p className="mb-3 mt-1 text-[12px] text-muted">{desc}</p>
      {children}
    </section>
  );
}

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

const METER_COLOR: Record<UsageMeter["state"], string> = {
  ok: "#185FA5",
  warn: "#8A5712",
  over: "#C0322F",
};

// Plan & usage: current tier, how close you are to its quotas, and an upgrade
// path. Usage counts come from the live backend; demo mode shows representative
// figures so the meters are still legible.
function PlanCard() {
  // No client-side plan getter yet, so default to Free (the app's default tier);
  // usage counts are fetched live below.
  const plan: Plan = "free";
  const [used, setUsed] = useState<{ companies: number; alertRules: number }>({
    companies: 38,
    alertRules: 2,
  });
  const [demo, setDemo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.companies("?limit=1"), api.listAlerts()])
      .then(([c, a]) => {
        setUsed({ companies: c.total, alertRules: a.rules.length });
      })
      .catch((e) => {
        if (e instanceof BackendOff) setDemo(true);
      });
  }, []);

  const quota = planQuota(plan);
  const meters = buildUsageMeters(plan, used);
  const up = nextPlan(plan);

  async function upgrade() {
    if (up !== "pro") return; // enterprise is "talk to us"; checkout is for Pro
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.billingCheckout(up);
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

  return (
    <Card
      title="Plan & usage"
      desc={`You're on the ${PLAN_LABEL[plan]} plan${demo ? " (demo figures shown)" : ""}. Seats up to ${quotaLabel(quota.seats)}.`}
    >
      <div className="space-y-3">
        {meters.map((m) => (
          <div key={m.key}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="text-muted">{m.label}</span>
              <span className="font-medium text-ink">
                {m.used} / {quotaLabel(m.limit)}
                {m.state === "over" && (
                  <span className="ml-1.5 text-[11px] font-medium text-[#C0322F]">
                    over limit
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E6E4DD]">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${m.limit == null ? 8 : Math.min(100, Math.round(m.ratio * 100))}%`,
                  backgroundColor: m.limit == null ? "#B4B2A9" : METER_COLOR[m.state],
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {up && (
        <div className="mt-4 flex items-center gap-3">
          {up === "enterprise" ? (
            <a
              href="/security"
              className="rounded-md px-3 py-2 text-[12px] font-medium text-white"
              style={{ backgroundColor: "#185FA5" }}
            >
              Talk to us about Enterprise
            </a>
          ) : (
            <button
              type="button"
              onClick={upgrade}
              disabled={busy}
              className="rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#185FA5" }}
            >
              {busy ? "Starting…" : `Upgrade to ${PLAN_LABEL[up]}`}
            </button>
          )}
          <span className="text-[12px] text-subtle">
            {up === "pro"
              ? "500 companies · 25 alert rules · 5 seats"
              : "Unlimited companies, alerts & seats"}
          </span>
        </div>
      )}
      {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
    </Card>
  );
}

type FrequencyOption = { value: string; label: string };

function FrequencyCard<T extends string>({
  title,
  desc,
  selectId,
  offlineMsg,
  options,
  prefKey,
  getFreq,
}: {
  title: string;
  desc: string;
  selectId: string;
  offlineMsg: string;
  options: FrequencyOption[];
  prefKey: "briefingFrequency" | "reportFrequency";
  getFreq: (prefs: Awaited<ReturnType<typeof api.getPreferences>>) => T;
}) {
  const [freq, setFreq] = useState<T>(options[0]!.value as T);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api
      .getPreferences()
      .then((r) => {
        setFreq(getFreq(r));
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof BackendOff) setOffline(true);
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(next: T) {
    setFreq(next);
    setSaving(true);
    try {
      await api.setPreferences({ [prefKey]: next });
    } catch {
      // best-effort — UI already reflects the choice
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title={title} desc={desc}>
      {offline ? (
        <p className="text-[12px] text-muted">{offlineMsg}</p>
      ) : (
        <div className="flex items-center gap-3">
          <label htmlFor={selectId} className="text-[12px] font-normal text-muted">
            Frequency
          </label>
          <select
            id={selectId}
            value={loaded ? freq : options[0]!.value}
            onChange={(e) => save(e.target.value as T)}
            disabled={!loaded || saving}
            className="rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-ink focus:outline-none disabled:opacity-50"
            style={{ border: "0.5px solid var(--border)" }}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {saving && <span className="text-[11px] font-normal text-subtle">Saving…</span>}
        </div>
      )}
    </Card>
  );
}

function BriefingCard() {
  return (
    <FrequencyCard<"off" | "daily" | "weekly">
      title="Email digest"
      desc="Receive a personalized briefing with your watchlist activity. Requires Resend to be configured."
      selectId="briefing-freq"
      offlineMsg="Email digest requires a connected backend."
      prefKey="briefingFrequency"
      getFreq={(r) => r.briefingFrequency}
      options={[
        { value: "off", label: "Off" },
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly (Monday)" },
      ]}
    />
  );
}

function ReportCard() {
  return (
    <FrequencyCard<"off" | "weekly" | "monthly">
      title="Scheduled pipeline reports"
      desc="Receive a pipeline snapshot email with a CSV attachment. Requires Resend to be configured."
      selectId="report-freq"
      offlineMsg="Scheduled reports require a connected backend."
      prefKey="reportFrequency"
      getFreq={(r) => r.reportFrequency}
      options={[
        { value: "off", label: "Off" },
        { value: "weekly", label: "Weekly (Monday)" },
        { value: "monthly", label: "Monthly (1st of month)" },
      ]}
    />
  );
}

function CalendarCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = loading
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .calendarFeed()
      .then((r) => {
        setEnabled(r.enabled);
        setUrl(r.url);
      })
      .catch((e) => {
        if (e instanceof BackendOff) setOffline(true);
        setEnabled(false);
      });
  }, []);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the input is selectable as a fallback
    }
  }

  return (
    <Card
      title="Calendar subscription"
      desc="Subscribe in Google, Outlook, or Apple Calendar to see deal milestones, task due dates, and bid dates. Add a calendar “from URL” and paste the link below."
    >
      {offline ? (
        <p className="text-[12px] text-muted">
          Calendar subscription requires a connected backend.
        </p>
      ) : enabled === null ? (
        <p className="text-[12px] text-subtle">Loading…</p>
      ) : !enabled ? (
        <p className="text-[12px] text-muted">
          Calendar feed is not configured on this deployment (CALENDAR_FEED_SECRET).
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url ?? ""}
            aria-label="Calendar subscription URL"
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-md bg-surface px-3 py-2 text-[12px] text-ink focus:outline-none"
            style={{ border: "0.5px solid var(--border)" }}
          />
          <button
            type="button"
            onClick={copy}
            className="rounded-md px-3 py-2 text-[12px] font-medium text-white"
            style={{ backgroundColor: "#185FA5" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </Card>
  );
}

function ExportCard() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/export", { cache: "no-store" });
      if (res.status === 503) throw new Error("Export is unavailable in demo mode.");
      if (!res.ok) throw new Error(`Export failed (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "arbor-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed.");
    }
    setBusy(false);
  }

  return (
    <Card
      title="Export your data"
      desc="Download a JSON copy of your profile, notes, and watchlist."
    >
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "#185FA5" }}
      >
        {busy ? "Preparing…" : "Download my data"}
      </button>
      {err && <p className="mt-2 text-[12px] text-[#791F1F]">{err}</p>}
    </Card>
  );
}

function DangerCard() {
  const [confirm, setConfirm] = useState(false);
  return (
    <Card
      title="Delete account"
      desc="Permanently delete your account, notes, and watchlist. This cannot be undone."
    >
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="rounded-md px-3 py-2 text-[12px] font-medium text-white"
        style={{ backgroundColor: "#791F1F" }}
      >
        Delete my account
      </button>
      {confirm && <DeleteModal onClose={() => setConfirm(false)} />}
    </Card>
  );
}

function DeleteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, onClose);
  const armed = text.trim().toUpperCase() === "DELETE";

  async function go() {
    if (!armed) return;
    setBusy(true);
    setErr(null);
    try {
      await api.deleteAccount();
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (e) {
      if (e instanceof BackendOff) {
        setErr("Account deletion is unavailable in demo mode.");
      } else {
        setErr(e instanceof Error ? e.message : "Deletion failed.");
      }
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm account deletion"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-surface p-5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-ink">Delete account</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-subtle hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[12px] text-muted">
          Type <span className="font-medium text-ink">DELETE</span> to confirm. This
          permanently removes your account and data.
        </p>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Type DELETE to confirm"
          className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
          style={{ border: "0.5px solid var(--border)" }}
        />
        {err && <p className="mb-3 text-[12px] text-[#791F1F]">{err}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
            style={{ border: "0.5px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={go}
            disabled={!armed || busy}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: "#791F1F" }}
          >
            {busy ? "Deleting…" : "Delete forever"}
          </button>
        </div>
      </div>
    </div>
  );
}
