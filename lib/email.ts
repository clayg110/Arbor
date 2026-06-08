// Transactional email via Resend's REST API (no SDK — one fetch). Provider-
// agnostic shape; swap the transport here without touching call sites. Dormant
// until RESEND_API_KEY + EMAIL_FROM are set: sendEmail then no-ops and logs a
// warning so flows (invites) still succeed in mock / unconfigured deployments.

import { log } from "./logger";
import { captureException } from "./observability";

export function hasEmailEnv(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendEmail(mail: Mail): Promise<SendResult> {
  if (!hasEmailEnv()) {
    log.warn("email skipped — RESEND_API_KEY/EMAIL_FROM unset", {
      to: mail.to,
      subject: mail.subject,
    });
    return { ok: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text ?? stripHtml(mail.html),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error("email send failed", { status: res.status, body: body.slice(0, 300) });
      return { ok: false };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    log.info("email sent", { to: mail.to, id: json.id });
    return { ok: true, id: json.id };
  } catch (e) {
    captureException(e, { scope: "email", to: mail.to });
    return { ok: false };
  }
}

// ---- templates --------------------------------------------------------------

const SHELL = (body: string): string =>
  `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:520px;margin:0 auto;padding:24px">${body}</div>`;

const BUTTON = (href: string, label: string): string =>
  `<a href="${href}" style="display:inline-block;background:#185FA5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${label}</a>`;

export function inviteEmail(opts: {
  orgName: string;
  inviterEmail: string;
  actionLink: string;
}): { subject: string; html: string } {
  return {
    subject: `You've been invited to ${opts.orgName} on Arbor`,
    html: SHELL(
      `<h1 style="font-size:18px;margin:0 0 12px">Join ${opts.orgName} on Arbor</h1>` +
        `<p style="font-size:14px;line-height:1.5;margin:0 0 20px">${opts.inviterEmail} invited you to the <strong>${opts.orgName}</strong> workspace — PE deal-lifecycle intelligence. Accept to set your password and get started.</p>` +
        BUTTON(opts.actionLink, "Accept invitation") +
        `<p style="font-size:12px;color:#888;margin:20px 0 0">If you weren't expecting this, you can ignore this email.</p>`
    ),
  };
}

// Dunning notice — sent to org admins when a subscription payment fails.
export function dunningEmail(opts: {
  orgName: string;
  status: string;
  manageUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Payment issue on your ${opts.orgName} subscription`,
    html: SHELL(
      `<h1 style="font-size:18px;margin:0 0 12px">Your payment didn't go through</h1>` +
        `<p style="font-size:14px;line-height:1.5;margin:0 0 20px">The latest payment for <strong>${opts.orgName}</strong> failed (status: ${opts.status}). Update your payment method to keep your plan active and avoid losing access.</p>` +
        BUTTON(opts.manageUrl, "Update payment method") +
        `<p style="font-size:12px;color:#888;margin:20px 0 0">If you've already fixed this, you can ignore this email.</p>`
    ),
  };
}
