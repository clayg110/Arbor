"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env-client";

// Reached after /auth/callback exchanges the recovery code → a transient
// session exists, so updateUser can set the new password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const configured = hasPublicSupabaseEnv();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setError("This reset link is invalid or has expired.");
      setReady(true);
    });
  }, [configured]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    setTimeout(() => {
      router.push("/radar");
      router.refresh();
    }, 1200);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div
        className="w-full max-w-sm rounded-xl bg-surface p-6"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="mb-6">
          <h1 className="text-[16px] font-medium text-ink">Set a new password</h1>
          <p className="text-[12px] font-normal text-muted">
            Choose a strong password for your account.
          </p>
        </div>

        {!ready ? (
          <p className="text-[13px] text-subtle">Verifying reset link…</p>
        ) : done ? (
          <p className="rounded-md bg-[#EAF3DE] px-3 py-2 text-[13px] text-[#27500A]">
            Password updated. Redirecting…
          </p>
        ) : (
          <form onSubmit={submit}>
            <label
              htmlFor="reset-password"
              className="mb-1 block text-[11px] font-normal text-muted"
            >
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              required
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              className="mb-1 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
              style={{ border: "0.5px solid var(--border)" }}
            />
            <p className="mb-4 text-[10px] font-normal text-subtle">
              At least 8 characters
            </p>

            <label
              htmlFor="reset-confirm"
              className="mb-1 block text-[11px] font-normal text-muted"
            >
              Confirm password
            </label>
            <input
              id="reset-confirm"
              type="password"
              required
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
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
              {busy ? "Updating…" : "Update password"}
            </button>
            <p className="mt-4 text-center text-[12px] font-normal text-muted">
              <Link href="/login" className="font-medium text-[#185FA5] hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
