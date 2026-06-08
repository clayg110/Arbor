"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env-client";

export default function ForgotPasswordPage() {
  const configured = hasPublicSupabaseEnv();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!configured) return setError("Auth is not configured (mock mode).");

    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div
        className="w-full max-w-sm rounded-xl bg-surface p-6"
        style={{ border: "0.5px solid var(--border)" }}
      >
        {sent ? (
          <>
            <h1 className="text-[16px] font-medium text-ink">Check your email</h1>
            <p className="mt-2 text-[13px] font-normal text-muted">
              If an account exists for{" "}
              <span className="font-medium text-ink">{email}</span>, a password-reset link
              is on its way.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-[13px] font-medium text-white"
              style={{ backgroundColor: "#185FA5" }}
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-[16px] font-medium text-ink">Reset your password</h1>
              <p className="text-[12px] font-normal text-muted">
                We&apos;ll email you a reset link.
              </p>
            </div>

            <form onSubmit={submit}>
              <label
                htmlFor="forgot-email"
                className="mb-1 block text-[11px] font-normal text-muted"
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
                style={{ border: "0.5px solid var(--border)" }}
              />
              {error && <p className="mb-3 text-[12px] text-[#791F1F]">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#185FA5" }}
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-4 text-center text-[12px] font-normal text-muted">
              <Link href="/login" className="font-medium text-[#185FA5] hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
