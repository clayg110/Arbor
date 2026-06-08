"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { domainFromEmail } from "@/lib/sso";

// Enterprise SSO entry. Collapsed by default; expands to take a work email,
// resolves the domain, and hands off to the org's SAML provider via Supabase.
export function SsoSignIn() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-md px-3 py-2 text-[13px] font-medium text-muted hover:text-ink"
        style={{ border: "0.5px solid var(--border)" }}
      >
        Sign in with SSO
      </button>
    );
  }

  async function go() {
    const domain = domainFromEmail(email);
    if (!domain) {
      setError("Enter a valid work email or domain.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await createClient().auth.signInWithSSO({ domain });
      if (error || !data?.url) {
        setError(error?.message ?? "No SSO provider is configured for that domain.");
        setBusy(false);
        return;
      }
      try {
        window.location.href = data.url;
      } catch {
        /* jsdom / non-browser */
      }
    } catch {
      setError("Could not start SSO.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <label className="mb-1 block text-[11px] font-normal text-muted">Work email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        aria-label="Work email for SSO"
        className="mb-2 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
        style={{ border: "0.5px solid var(--border)" }}
      />
      {error && <p className="mb-2 text-[12px] text-[#791F1F]">{error}</p>}
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="w-full rounded-md px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "#185FA5" }}
      >
        {busy ? "Redirecting…" : "Continue with SSO"}
      </button>
    </div>
  );
}
