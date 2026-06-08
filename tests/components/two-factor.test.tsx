// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TwoFactorSection } from "@/components/ui/TwoFactorSection";

const h = vi.hoisted(() => ({
  mfa: {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
    unenroll: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { mfa: h.mfa } }),
}));

beforeEach(() => {
  Object.values(h.mfa).forEach((fn) => fn.mockReset());
});

describe("TwoFactorSection", () => {
  it("enrolls + verifies a TOTP factor", async () => {
    const user = userEvent.setup();
    h.mfa.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    h.mfa.enroll.mockResolvedValue({
      data: { id: "f1", totp: { qr_code: "data:image/svg+xml,QR", secret: "S3CR3T" } },
      error: null,
    });
    h.mfa.challenge.mockResolvedValue({ data: { id: "ch1" }, error: null });
    h.mfa.verify.mockResolvedValue({ data: {}, error: null });

    render(<TwoFactorSection />);

    await user.click(await screen.findByRole("button", { name: /enable two-factor/i }));

    expect(await screen.findByText("S3CR3T")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Authentication code"), "123456");
    await user.click(screen.getByRole("button", { name: /verify \+ enable/i }));

    expect(await screen.findByText("Enabled")).toBeInTheDocument();
    expect(h.mfa.challenge).toHaveBeenCalledWith({ factorId: "f1" });
    expect(h.mfa.verify).toHaveBeenCalledWith({
      factorId: "f1",
      challengeId: "ch1",
      code: "123456",
    });
  });

  it("shows enabled + Disable when a verified factor exists", async () => {
    h.mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "f1", status: "verified" }] },
      error: null,
    });
    render(<TwoFactorSection />);
    expect(await screen.findByText("Enabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disable/i })).toBeInTheDocument();
  });

  it("is unavailable when MFA errors (e.g. mock mode)", async () => {
    h.mfa.listFactors.mockResolvedValue({ data: null, error: { message: "no session" } });
    render(<TwoFactorSection />);
    expect(await screen.findByText(/only available when signed in/i)).toBeInTheDocument();
  });
});
