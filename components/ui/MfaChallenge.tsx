"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Second-factor prompt shown after a password sign-in when the account has a
// verified TOTP factor. Resolves the factor, challenges it, verifies the code,
// then hands back to the login flow.
export function MfaChallenge({ onDone }: { onDone: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await createClient().auth.mfa.listFactors();
        const totp = (data?.totp ?? []).find((f) => f.status === "verified");
        if (totp) setFactorId(totp.id);
        else setError("No verified authenticator found for this account.");
      } catch {
        setError("Could not load your authenticator.");
      }
    })();
  }, []);

  async function verify() {
    if (!factorId || code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const mfa = createClient().auth.mfa;
      const ch = await mfa.challenge({ factorId });
      if (ch.error || !ch.data) {
        setError(ch.error?.message ?? "Verification failed");
        setBusy(false);
        return;
      }
      const v = await mfa.verify({
        factorId,
        challengeId: ch.data.id,
        code: code.trim(),
      });
      if (v.error) {
        setError(v.error.message);
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError("Verification failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-[16px] font-medium text-ink">Two-factor verification</h1>
      <p className="mb-4 text-[12px] font-normal text-muted">
        Enter the 6-digit code from your authenticator app.
      </p>
      <label className="mb-1 block text-[11px] font-normal text-muted">Code</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoFocus
        aria-label="Authentication code"
        placeholder="123456"
        className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus-ring"
        style={{ border: "0.5px solid var(--border)" }}
      />
      {error && <p className="mb-3 text-[12px] text-[#791F1F]">{error}</p>}
      <button
        type="button"
        onClick={verify}
        disabled={busy || code.trim().length < 6}
        className="w-full rounded-md px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "#185FA5" }}
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
    </div>
  );
}
