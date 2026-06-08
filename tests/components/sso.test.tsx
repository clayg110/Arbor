// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SsoSignIn } from "@/components/ui/SsoSignIn";

const h = vi.hoisted(() => ({ signInWithSSO: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithSSO: h.signInWithSSO } }),
}));

beforeEach(() => h.signInWithSSO.mockReset());

describe("SsoSignIn", () => {
  it("resolves the domain + starts SSO", async () => {
    const user = userEvent.setup();
    h.signInWithSSO.mockResolvedValue({
      data: { url: "https://idp/login" },
      error: null,
    });

    render(<SsoSignIn />);
    await user.click(screen.getByRole("button", { name: "Sign in with SSO" }));
    await user.type(screen.getByLabelText("Work email for SSO"), "jane@acme.com");
    await user.click(screen.getByRole("button", { name: /continue with sso/i }));

    expect(h.signInWithSSO).toHaveBeenCalledWith({ domain: "acme.com" });
  });

  it("shows an error for an invalid email (no SSO call)", async () => {
    const user = userEvent.setup();
    render(<SsoSignIn />);
    await user.click(screen.getByRole("button", { name: "Sign in with SSO" }));
    await user.type(screen.getByLabelText("Work email for SSO"), "nope");
    await user.click(screen.getByRole("button", { name: /continue with sso/i }));

    expect(screen.getByText(/valid work email/i)).toBeInTheDocument();
    expect(h.signInWithSSO).not.toHaveBeenCalled();
  });
});
