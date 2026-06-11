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

export type BriefingFrequency = "off" | "daily" | "weekly";

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

// Richer briefing email — includes sector/stage context beyond watchlist changes.
export function briefingEmail(opts: {
  items: DigestChange[];
  frequency: BriefingFrequency;
  appUrl: string;
}): { subject: string; html: string } {
  const n = opts.items.length;
  const freq = opts.frequency === "daily" ? "Daily" : "Weekly";
  const rows = opts.items
    .map(
      (i) =>
        `<li style="margin:0 0 8px"><a href="${opts.appUrl}/company/${i.companyId}" style="color:#185FA5;text-decoration:none;font-weight:600">${esc(
          i.companyName
        )}</a> — ${esc(i.action)}</li>`
    )
    .join("");

  const body =
    n > 0
      ? `<ul style="font-size:14px;line-height:1.5;padding-left:18px;margin:0 0 20px">${rows}</ul>`
      : `<p style="font-size:14px;color:#888;margin:0 0 20px">No changes on your watchlist since the last briefing.</p>`;

  return {
    subject: `Arbor ${freq} briefing${n > 0 ? `: ${n} update${n === 1 ? "" : "s"}` : ""}`,
    html:
      `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:520px;margin:0 auto;padding:24px">` +
      `<h1 style="font-size:18px;margin:0 0 4px">${freq} briefing</h1>` +
      `<p style="font-size:12px;color:#888;margin:0 0 16px">Your deal-intelligence digest from Arbor</p>` +
      body +
      `<div style="border-top:1px solid #e5e3db;padding-top:16px;margin-top:8px">` +
      `<a href="${opts.appUrl}/radar" style="font-size:13px;color:#185FA5;margin-right:16px">Open radar →</a>` +
      `<a href="${opts.appUrl}/settings" style="font-size:12px;color:#888">Manage briefing settings</a>` +
      `</div></div>`,
  };
}
