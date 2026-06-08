"use client";

import { Suspense, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env-client";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { passesTurnstile } from "@/lib/turnstile-client";

function SignupForm() {
  const router = useRouter();
  const configured = hasPublicSupabaseEnv();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [botToken, setBotToken] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!configured) return setError("Auth is not configured (mock mode).");

    setBusy(true);
    if (!(await passesTurnstile(botToken))) {
      setError("Bot check failed. Please retry.");
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "analyst", name: name.trim() || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (signErr) {
      setError(signErr.message);
      setBusy(false);
      return;
    }
    // Confirmations off → session returned immediately. On → must confirm email.
    if (data.session) {
      router.push("/radar");
      router.refresh();
      return;
    }
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <Shell>
        <h1 className="text-[16px] font-medium text-ink">Check your email</h1>
        <p className="mt-2 text-[13px] font-normal text-muted">
          We sent a confirmation link to{" "}
          <span className="font-medium text-ink">{email}</span>. Click it to activate your
          account, then sign in.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-[13px] font-medium text-white"
          style={{ backgroundColor: "#185FA5" }}
        >
          Back to sign in
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-[16px] font-medium text-ink">Create your Arbor account</h1>
        <p className="text-[12px] font-normal text-muted">
          PE deal intelligence — sign up
        </p>
      </div>

      {!configured && (
        <p className="mb-4 rounded-md bg-[#FAEEDA] px-3 py-2 text-[12px] text-[#633806]">
          Backend not configured — running in mock mode. Set Supabase env to enable
          accounts.
        </p>
      )}

      <form onSubmit={submit}>
        <Field
          label="Name"
          value={name}
          onChange={setName}
          type="text"
          autoComplete="name"
          required={false}
        />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
        />
        <Field
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          type="password"
          autoComplete="new-password"
        />

        <TurnstileWidget onToken={setBotToken} />

        {error && <p className="mb-3 text-[12px] text-[#791F1F]">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-[12px] font-normal text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#185FA5] hover:underline">
          Sign in
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div
        className="w-full max-w-sm rounded-xl bg-surface p-6"
        style={{ border: "0.5px solid var(--border)" }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  autoComplete,
  hint,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-[11px] font-normal text-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
        style={{ border: "0.5px solid var(--border)" }}
      />
      {hint && <p className="mt-1 text-[10px] font-normal text-subtle">{hint}</p>}
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
