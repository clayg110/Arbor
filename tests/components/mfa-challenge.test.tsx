// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MfaChallenge } from "@/components/ui/MfaChallenge";

const h = vi.hoisted(() => ({
  mfa: { listFactors: vi.fn(), challenge: vi.fn(), verify: vi.fn() },
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { mfa: h.mfa } }),
}));

beforeEach(() => Object.values(h.mfa).forEach((fn) => fn.mockReset()));

describe("MfaChallenge", () => {
  it("challenges + verifies the code, then signals done", async () => {
    const user = userEvent.setup();
    h.mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "f1", status: "verified" }] },
      error: null,
    });
    h.mfa.challenge.mockResolvedValue({ data: { id: "ch1" }, error: null });
    h.mfa.verify.mockResolvedValue({ data: {}, error: null });
    const onDone = vi.fn();

    render(<MfaChallenge onDone={onDone} />);
    await user.type(screen.getByLabelText("Authentication code"), "123456");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(h.mfa.verify).toHaveBeenCalledWith({
      factorId: "f1",
      challengeId: "ch1",
      code: "123456",
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("surfaces a wrong-code error and does not finish", async () => {
    const user = userEvent.setup();
    h.mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "f1", status: "verified" }] },
      error: null,
    });
    h.mfa.challenge.mockResolvedValue({ data: { id: "ch1" }, error: null });
    h.mfa.verify.mockResolvedValue({ data: null, error: { message: "Invalid code" } });
    const onDone = vi.fn();

    render(<MfaChallenge onDone={onDone} />);
    await user.type(screen.getByLabelText("Authentication code"), "000000");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText("Invalid code")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
