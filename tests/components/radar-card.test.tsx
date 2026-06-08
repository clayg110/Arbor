// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadarCompanyCard } from "@/components/ui/RadarCompanyCard";
import type { RadarCompany } from "@/lib/radar-data";

const company: RadarCompany = {
  id: "r1",
  companyId: "c1",
  name: "Acme Specialty",
  dealType: "carveout",
  sector: "chemicals",
  confidence: "high",
  stage: "in_market",
  ownerName: "Dow Inc.",
  days: 12,
  added: "2026-01-01T00:00:00Z",
  addedDisplay: "Jan 1 2026",
  lastSignal: {
    label: "2d ago",
    sourceName: "SEC EDGAR",
    source: "sec_filing",
    daysAgo: 2,
  },
};

describe("RadarCompanyCard — keyboard stage move", () => {
  it("opens a menu of other stages and moves on selection", async () => {
    const onMoveStage = vi.fn();
    const user = userEvent.setup();
    render(
      <RadarCompanyCard
        c={company}
        watched={false}
        onToggleWatch={() => {}}
        onMoveStage={onMoveStage}
      />
    );

    const trigger = screen.getByRole("button", { name: /move stage/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const menu = screen.getByRole("menu", { name: "Move to stage" });
    expect(menu).toBeInTheDocument();
    // current stage is excluded
    expect(screen.queryByRole("menuitem", { name: "In market" })).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "On hold" }));
    expect(onMoveStage).toHaveBeenCalledWith("on_hold");
    // menu closes after selection
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders no move control when onMoveStage is absent", () => {
    render(<RadarCompanyCard c={company} watched={false} onToggleWatch={() => {}} />);
    expect(screen.queryByRole("button", { name: /move stage/i })).toBeNull();
  });
});
