// Cloudflare Turnstile bot protection. Dormant until keys:
//  - NEXT_PUBLIC_TURNSTILE_SITE_KEY renders the widget (client).
//  - TURNSTILE_SECRET_KEY enables server-side verification.
// With no secret, verifyTurnstile passes (mock mode) so the app stays usable.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
}

export function hasTurnstileSecret(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export interface TurnstileResult {
  ok: boolean;
  dormant?: boolean;
  errors?: string[];
}

// Pure: read Cloudflare's siteverify JSON into a verdict. Cloudflare returns
// `{ success: boolean, "error-codes": string[] }`; anything else is a failure.
export function interpretSiteverify(body: unknown): TurnstileResult {
  const b = (body ?? {}) as { success?: unknown; "error-codes"?: unknown };
  const ok = b.success === true;
  const raw = b["error-codes"];
  const errors = Array.isArray(raw)
    ? raw.filter((e): e is string => typeof e === "string")
    : [];
  return { ok, errors };
}

// Verify a solved Turnstile token against Cloudflare. Fail-closed when a secret
// is configured (bad/missing token → ok:false); fully dormant otherwise.
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteip?: string | null
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, dormant: true }; // no enforcement in mock mode
  if (!token) return { ok: false, errors: ["missing-input-response"] };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteip) form.set("remoteip", remoteip);

  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) return { ok: false, errors: [`http-${res.status}`] };
    return interpretSiteverify(await res.json());
  } catch {
    return { ok: false, errors: ["fetch-failed"] };
  }
}
