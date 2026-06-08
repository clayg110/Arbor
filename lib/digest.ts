// Watchlist digest: pure grouping + email template. The cron supplies recent
// stage changes + the watchlist; buildUserDigests intersects them so each user
// only hears about companies they actually watch. Email transport lives in
// lib/email.ts (dormant until Resend is configured).

export interface DigestChange {
  companyId: string;
  companyName: string;
  action: string; // human-readable, e.g. "Moved to In market"
  at: string; // ISO
}

export interface UserDigest {
  userId: string;
  items: DigestChange[];
}

// One digest per user, containing only their watched companies that changed.
export function buildUserDigests(
  changes: DigestChange[],
  watchlist: { user_id: string; company_id: string }[]
): UserDigest[] {
  const byCompany = new Map<string, DigestChange[]>();
  for (const c of changes) {
    const list = byCompany.get(c.companyId);
    if (list) list.push(c);
    else byCompany.set(c.companyId, [c]);
  }

  const byUser = new Map<string, DigestChange[]>();
  for (const w of watchlist) {
    const cs = byCompany.get(w.company_id);
    if (!cs) continue;
    const list = byUser.get(w.user_id);
    if (list) list.push(...cs);
    else byUser.set(w.user_id, [...cs]);
  }

  return [...byUser].map(([userId, items]) => ({ userId, items }));
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function digestEmail(opts: { items: DigestChange[]; appUrl: string }): {
  subject: string;
  html: string;
} {
  const n = opts.items.length;
  const rows = opts.items
    .map(
      (i) =>
        `<li style="margin:0 0 8px"><a href="${opts.appUrl}/company/${i.companyId}" style="color:#185FA5;text-decoration:none;font-weight:600">${esc(
          i.companyName
        )}</a> — ${esc(i.action)}</li>`
    )
    .join("");

  return {
    subject: `Arbor: ${n} update${n === 1 ? "" : "s"} on your watchlist`,
    html:
      `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:520px;margin:0 auto;padding:24px">` +
      `<h1 style="font-size:18px;margin:0 0 12px">Your watchlist moved</h1>` +
      `<ul style="font-size:14px;line-height:1.5;padding-left:18px;margin:0 0 20px">${rows}</ul>` +
      `<a href="${opts.appUrl}/watchlist" style="font-size:13px;color:#185FA5">Open your watchlist →</a>` +
      `</div>`,
  };
}
