import type { Stage, DealType, Confidence, Sector, FeedEventType } from "./types";

// Exact hex values from the design system. Inline styles keep them precise
// (and out of Tailwind's purge guesswork).

export interface Swatch {
  bg: string;
  text: string;
  border?: string;
}

export const STAGE_COLORS: Record<Stage, Swatch> = {
  in_market: { bg: "#E6F1FB", text: "#0C447C", border: "#185FA5" },
  monitor_for_exit: { bg: "#FAEEDA", text: "#633806", border: "#BA7517" },
  on_hold: { bg: "#FCEBEB", text: "#791F1F", border: "#E24B4A" },
  pulled: { bg: "#FCEBEB", text: "#791F1F", border: "#E24B4A" },
};

export const STAGE_LABELS: Record<Stage, string> = {
  in_market: "In market",
  monitor_for_exit: "Monitor for exit",
  on_hold: "On hold",
  pulled: "Pulled",
};

// Solid dot color per stage (for watchlist / timeline dots).
export const STAGE_DOT: Record<Stage, string> = {
  in_market: "#185FA5",
  monitor_for_exit: "#BA7517",
  on_hold: "#E24B4A",
  pulled: "#9A9890",
};

export const DEAL_TYPE_COLORS: Record<DealType, Swatch> = {
  carveout: { bg: "#EEEDFE", text: "#3C3489" },
  private_asset: { bg: "#E1F5EE", text: "#085041" },
};

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  carveout: "Carveout",
  private_asset: "Private asset",
};

export const CONFIDENCE_COLORS: Record<Confidence, Swatch> = {
  high: { bg: "#EAF3DE", text: "#27500A" },
  medium: { bg: "#FAEEDA", text: "#633806" },
  low: { bg: "#FCEBEB", text: "#791F1F" },
  needs_review: { bg: "#FCEBEB", text: "#791F1F" },
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  needs_review: "Needs review",
};

export const SECTOR_SWATCH: Swatch = { bg: "#F1EFE8", text: "#444441" };

export const SECTOR_LABELS: Record<Sector, string> = {
  // legacy demo sectors
  chemicals: "Chemicals",
  industrials: "Industrials",
  agriculture: "Agriculture",
  specialty_materials: "Specialty materials",
  energy_fuels: "Energy & fuels",
  pharma_inputs: "Pharma inputs",
  consumer_coatings: "Consumer & coatings",
  // real taxonomy (Backend §2.1)
  aerospace_defense: "Aerospace & Defense",
  capital_goods: "Capital Goods",
  automotive: "Automotive",
  transportation: "Transportation",
  basic_materials: "Basic Materials",
};

export const SECTORS = Object.keys(SECTOR_LABELS) as Sector[];

export const NEW_ENTRY_SWATCH: Swatch = { bg: "#EAF3DE", text: "#27500A" };

// Feed event circular-icon background color.
export const EVENT_ICON_COLOR: Record<FeedEventType, string> = {
  moved_in_market: "#185FA5",
  moved_monitor: "#BA7517",
  moved_on_hold: "#E24B4A",
  pulled: "#E24B4A",
  new_entry: "#27500A",
  flagged: "#BA7517",
  hsr_filed: "#185FA5",
};

// Chart palette.
export const CHART = {
  carveout: "#185FA5",
  private_asset: "#1D9E75",
  in_market: "#185FA5",
  monitor: "#BA7517",
  on_hold: "#9A9890",
};
