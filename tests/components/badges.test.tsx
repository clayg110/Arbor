// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageBadge } from "@/components/ui/StageBadge";
import { DealTypeBadge } from "@/components/ui/DealTypeBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { Pill } from "@/components/ui/Pill";

describe("StageBadge", () => {
  it("renders the stage label", () => {
    render(<StageBadge stage="in_market" />);
    expect(screen.getByText("In market")).toBeInTheDocument();
  });

  it("falls back to an em dash on a null stage", () => {
    render(<StageBadge stage={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("DealTypeBadge", () => {
  it("labels carveout + private asset", () => {
    const { rerender } = render(<DealTypeBadge type="carveout" />);
    expect(screen.getByText("Carveout")).toBeInTheDocument();
    rerender(<DealTypeBadge type="private_asset" />);
    expect(screen.getByText("Private asset")).toBeInTheDocument();
  });
});

describe("ConfidenceBadge", () => {
  it("renders the confidence label", () => {
    render(<ConfidenceBadge confidence="high" />);
    expect(screen.getByText("High confidence")).toBeInTheDocument();
  });

  it("shows a pulse dot only for needs_review", () => {
    const { container, rerender } = render(<ConfidenceBadge confidence="high" />);
    expect(container.querySelector(".animate-ping-dot")).toBeNull();
    rerender(<ConfidenceBadge confidence="needs_review" />);
    expect(container.querySelector(".animate-ping-dot")).not.toBeNull();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });
});

describe("MetricCard", () => {
  it("renders label + value", () => {
    render(<MetricCard label="Active deals" value="42" />);
    expect(screen.getByText("Active deals")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders delta text when provided", () => {
    render(
      <MetricCard label="x" value="1" delta={{ direction: "up", text: "+3 this week" }} />
    );
    expect(screen.getByText("+3 this week")).toBeInTheDocument();
  });
});

describe("Pill", () => {
  it("renders children with the given colors", () => {
    render(
      <Pill bg="#000000" text="#ffffff">
        Hello
      </Pill>
    );
    const el = screen.getByText("Hello");
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ backgroundColor: "#000000" });
  });
});
