"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SsoSignIn } from "@/components/ui/SsoSignIn";
import { MfaChallenge } from "@/components/ui/MfaChallenge";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { needsStepUp } from "@/lib/mfa";
import { passesTurnstile } from "@/lib/turnstile-client";
import {
  checkLoginAllowed,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/lockout-client";
import { retryAfterLabel } from "@/lib/lockout";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") || "/radar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth_callback"
      ? "That link was invalid or expired. Please try again."
      : null
  );

  function finish() {
    router.push(redirectTo);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (!(await passesTurnstile(botToken))) {
      setError("Bot check failed. Please retry.");
      setBusy(false);
      return;
    }
    const guard = await checkLoginAllowed(email);
    if (guard.locked) {
      setError(
        `Too many failed attempts. Try again in ${retryAfterLabel(guard.retryAfter)}.`
      );
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) {
      const after = await recordLoginFailure(email);
      setError(
        after.locked
          ? `Too many failed attempts. Try again in ${retryAfterLabel(after.retryAfter)}.`
          : signErr.message
      );
      setBusy(false);
      return;
    }
    clearLoginFailures(email);
    // Step up to AAL2 if the account has a verified second factor.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (needsStepUp(aal)) {
      setStepUp(true);
      setBusy(false);
      return;
    }
    finish();
  }

  if (stepUp) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div
          className="w-full max-w-sm rounded-xl bg-surface p-6"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <MfaChallenge onDone={finish} />
        </div>
      </div>
    );
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
          <p className="text-[12px] font-normal text-muted">
            PE deal intelligence — sign in
          </p>
        </div>

        <label
          htmlFor="login-email"
          className="mb-1 block text-[11px] font-normal text-muted"
        >
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
          style={{ border: "0.5px solid var(--border)" }}
        />

        <label
          htmlFor="login-password"
          className="mb-1 block text-[11px] font-normal text-muted"
        >
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
          style={{ border: "0.5px solid var(--border)" }}
        />

        <TurnstileWidget onToken={setBotToken} />

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

        <div className="my-4 h-px" style={{ backgroundColor: "var(--border)" }} />
        <SsoSignIn />
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
