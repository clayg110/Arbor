"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api, BackendOff } from "@/lib/api-client";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { TwoFactorSection } from "@/components/ui/TwoFactorSection";
import { SettingsIcon, XIcon } from "@/components/ui/icons";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[680px]">
      <div className="mb-6 flex items-center gap-2">
        <SettingsIcon className="h-[18px] w-[18px] text-muted" />
        <h1 className="text-[18px] font-medium text-ink">Account &amp; privacy</h1>
      </div>

      <TwoFactorSection />
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
