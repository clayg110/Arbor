// Client-side bot-check guard. POSTs a solved Turnstile token to the verify
// route and returns whether the action may proceed. In mock mode (no secret)
// the route answers ok:true, so this transparently passes. A network failure to
// our own endpoint is treated as allowed — we don't hard-block real users on a
// transient blip; Cloudflare's verdict is the only thing that blocks.
export async function passesTurnstile(token: string | null): Promise<boolean> {
  try {
    const res = await fetch("/api/security/turnstile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json()) as { ok?: boolean };
    return data.ok !== false;
  } catch {
    return true;
  }
}
