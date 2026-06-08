import { describe, it, expect, afterEach, vi } from "vitest";
import {
  hasEmailEnv,
  sendEmail,
  stripHtml,
  inviteEmail,
  dunningEmail,
} from "@/lib/email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("hasEmailEnv", () => {
  it("requires both key + from address", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    expect(hasEmailEnv()).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_x");
    expect(hasEmailEnv()).toBe(false);
    vi.stubEnv("EMAIL_FROM", "a@b.com");
    expect(hasEmailEnv()).toBe(true);
  });
});

describe("sendEmail", () => {
  it("no-ops (ok:false) when unconfigured, without hitting the network", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await sendEmail({ to: "x@y.com", subject: "hi", html: "<p>hi</p>" });
    expect(r.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to Resend + returns the id on success", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_x");
    vi.stubEnv("EMAIL_FROM", "Arbor <a@b.com>");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    const r = await sendEmail({ to: "x@y.com", subject: "hi", html: "<p>hi</p>" });
    expect(r).toEqual({ ok: true, id: "msg_1" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_x");
  });

  it("returns ok:false on a non-2xx response", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_x");
    vi.stubEnv("EMAIL_FROM", "a@b.com");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 422 })
    );
    expect((await sendEmail({ to: "x@y.com", subject: "s", html: "h" })).ok).toBe(false);
  });
});

describe("stripHtml", () => {
  it("strips tags + entities to plain text", () => {
    expect(stripHtml("<p>Hello&nbsp;<b>world</b></p>")).toBe("Hello world");
  });
});

describe("inviteEmail", () => {
  it("embeds org name + action link", () => {
    const { subject, html } = inviteEmail({
      orgName: "Acme PE",
      inviterEmail: "boss@acme.com",
      actionLink: "https://app/accept?token=abc",
    });
    expect(subject).toContain("Acme PE");
    expect(html).toContain("https://app/accept?token=abc");
    expect(html).toContain("boss@acme.com");
  });
});

describe("dunningEmail", () => {
  it("names the org, status, and a manage link", () => {
    const { subject, html } = dunningEmail({
      orgName: "Acme PE",
      status: "past_due",
      manageUrl: "https://app/admin",
    });
    expect(subject).toContain("Acme PE");
    expect(html).toContain("past_due");
    expect(html).toContain("https://app/admin");
  });
});
