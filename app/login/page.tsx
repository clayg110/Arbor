"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") || "/radar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth_callback"
      ? "That link was invalid or expired. Please try again."
      : null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) {
      setError(signErr.message);
      setBusy(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-surface p-6"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="mb-6">
          <h1 className="text-[16px] font-medium text-ink">Arbor</h1>
          <p className="text-[12px] font-normal text-muted">PE deal intelligence — sign in</p>
        </div>

        <label className="mb-1 block text-[11px] font-normal text-muted">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
          style={{ border: "0.5px solid var(--border)" }}
        />

        <label className="mb-1 block text-[11px] font-normal text-muted">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div className="mt-4 flex items-center justify-between text-[12px] font-normal">
          <Link href="/forgot-password" className="text-muted hover:text-ink">
            Forgot password?
          </Link>
          <Link href="/signup" className="font-medium text-[#185FA5] hover:underline">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
