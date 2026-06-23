"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "loading" | "disabled" | "enrolling" | "enabled" | "unavailable";

interface Enrollment {
  factorId: string;
  qr: string;
  secret: string;
}

// TOTP two-factor management via Supabase MFA. Requires a live session, so it
// shows an "unavailable" note in mock mode rather than erroring.
export function TwoFactorSection() {
  const [status, setStatus] = useState<Status>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await createClient().auth.mfa.listFactors();
      if (error) {
        setStatus("unavailable");
        return;
      }
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setStatus("enabled");
      } else {
        setStatus("disabled");
      }
    } catch {
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await createClient().auth.mfa.enroll({
        factorType: "totp",
      });
      if (error || !data) {
        setError(error?.message ?? "Could not start enrollment");
      } else {
        setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
        setStatus("enrolling");
      }
    } catch {
      setError("Could not start enrollment");
    }
    setBusy(false);
  }

  async function confirmEnroll() {
    if (!enroll || code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const mfa = createClient().auth.mfa;
      const ch = await mfa.challenge({ factorId: enroll.factorId });
      if (ch.error || !ch.data) {
        setError(ch.error?.message ?? "Verification failed");
      } else {
        const v = await mfa.verify({
          factorId: enroll.factorId,
          challengeId: ch.data.id,
          code: code.trim(),
        });
        if (v.error) {
          setError(v.error.message);
        } else {
          setEnroll(null);
          setCode("");
          setFactorId(enroll.factorId);
          setStatus("enabled");
        }
      }
    } catch {
      setError("Verification failed");
    }
    setBusy(false);
  }

  async function disable() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      await createClient().auth.mfa.unenroll({ factorId });
      setFactorId(null);
      setStatus("disabled");
    } catch {
      setError("Could not disable");
    }
    setBusy(false);
  }

  return (
    <section
      className="mb-4 rounded-lg bg-surface p-5"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <h2 className="text-[14px] font-medium text-ink">Two-factor authentication</h2>
      <p className="mb-3 mt-1 text-[12px] text-muted">
        Add a time-based one-time code (TOTP) from an authenticator app.
      </p>

      {status === "loading" && <p className="text-[12px] text-subtle">Loading…</p>}

      {status === "unavailable" && (
        <p className="text-[12px] text-subtle">
          Two-factor is only available when signed in to a live account.
        </p>
      )}

      {status === "disabled" && (
        <button
          type="button"
          onClick={startEnroll}
          disabled={busy}
          className="rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          {busy ? "…" : "Enable two-factor"}
        </button>
      )}

      {status === "enrolling" && enroll && (
        <div>
          <p className="mb-2 text-[12px] text-muted">
            Scan this QR in your authenticator, or enter the secret manually, then confirm
            the 6-digit code.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="TOTP QR code" className="mb-2 h-40 w-40" />
          <code className="mb-3 block break-all text-[11px] text-subtle">
            {enroll.secret}
          </code>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="123456"
            aria-label="Authentication code"
            className="mb-3 w-40 rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus-ring"
            style={{ border: "0.5px solid var(--border)" }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmEnroll}
              disabled={busy || code.trim().length < 6}
              className="rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "#185FA5" }}
            >
              {busy ? "Verifying…" : "Verify + enable"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEnroll(null);
                setStatus("disabled");
              }}
              className="rounded-md px-3 py-2 text-[12px] font-medium text-muted hover:text-ink"
              style={{ border: "0.5px solid var(--border)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === "enabled" && (
        <div className="flex items-center gap-3">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: "#EAF3DE", color: "#27500A" }}
          >
            Enabled
          </span>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink disabled:opacity-50"
            style={{ border: "0.5px solid var(--border)" }}
          >
            {busy ? "…" : "Disable"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-[#791F1F]">{error}</p>}
    </section>
  );
}
