// Client-side login-guard calls. Talk to /api/security/login-guard (which keys
// off the server-derived IP, never a client-supplied one). Every call fails OPEN
// on a network error to our own endpoint — a transient blip must not lock real
// users out; Redis on the server is the only thing that blocks.

export interface LoginGuard {
  locked: boolean;
  retryAfter: number; // seconds
}

async function post(action: string, email: string): Promise<LoginGuard> {
  try {
    const res = await fetch("/api/security/login-guard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, email }),
    });
    const d = (await res.json()) as Partial<LoginGuard>;
    return { locked: d.locked === true, retryAfter: Number(d.retryAfter ?? 0) };
  } catch {
    return { locked: false, retryAfter: 0 };
  }
}

export const checkLoginAllowed = (email: string) => post("check", email);
export const recordLoginFailure = (email: string) => post("fail", email);

// Fire-and-forget: clear counters after a correct password.
export function clearLoginFailures(email: string): void {
  void post("reset", email);
}
