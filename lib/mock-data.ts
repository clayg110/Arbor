import type {
  Company,
  StageHistoryRecord,
  Signal,
  Note,
  FeedEvent,
  ReviewItem,
} from "./types";
import { topComps, type CompInput, type CompResult } from "./comps";
import { bankerIntelligence, type Contact, type CompanyContact } from "./contacts";
import type { Bid } from "./bids";
import type { ContactLink } from "./relationship-graph";
import type { PipelineDeal } from "./pipeline";
import { buildLpReport, currentQuarter, type LpDeal, type LpFund } from "./lp-report";

// All dates are anchored around "today" = 2026-06-02 for realistic relative ages.

export const mockCompanies: Company[] = [
  {
    id: "1",
    name: "Dow Polyurethanes",
    sector: "chemicals",
    dealType: "carveout",
    parentCompany: "Dow Inc.",
    description:
      "Polyurethanes and propylene oxide/propylene glycol unit reported to be under strategic review as Dow streamlines its commodity portfolio.",
    confidence: "high",
    currentStage: "in_market",
    daysInStage: 42,
    firstTracked: "2026-01-09",
    lastUpdated: "2026-04-21",
  },
  {
    id: "2",
    name: "EPSilyte",
    sector: "specialty_materials",
    dealType: "private_asset",
    sponsorFirm: "Arsenal Capital Partners",
    description:
      "Expandable polystyrene (EPS) producer for insulation and packaging; sponsor has held the asset since 2019 and is evaluating exit options.",
    confidence: "medium",
    currentStage: "monitor_for_exit",
    daysInStage: 130,
    firstTracked: "2025-08-14",
    lastUpdated: "2026-01-23",
  },
  {
    id: "3",
    name: "Celanese Infraserv",
    sector: "chemicals",
    dealType: "carveout",
    parentCompany: "Celanese Corporation",
    description:
      "Site-services and utilities operations attached to Celanese's European footprint, flagged in recent deleveraging commentary.",
    confidence: "high",
    currentStage: "in_market",
    daysInStage: 8,
    firstTracked: "2026-05-04",
    lastUpdated: "2026-05-25",
  },
  {
    id: "4",
    name: "Mosaic Brazil Assets",
    sector: "agriculture",
    dealType: "carveout",
    parentCompany: "The Mosaic Company",
    description:
      "Brazilian distribution and blending assets; press reports suggest a possible divestiture but the company has not confirmed a process.",
    confidence: "needs_review",
    currentStage: "in_market",
    daysInStage: 3,
    firstTracked: "2026-05-30",
    lastUpdated: "2026-05-30",
  },
  {
    id: "5",
    name: "GEON Performance Solutions",
    sector: "specialty_materials",
    dealType: "private_asset",
    sponsorFirm: "SK Capital Partners",
    description:
      "Vinyl and polymer compounding platform formed from PolyOne's distribution carve-out; long-held sponsor asset approaching typical exit window.",
    confidence: "high",
    currentStage: "monitor_for_exit",
    daysInStage: 210,
    firstTracked: "2025-04-02",
    lastUpdated: "2025-11-04",
  },
  {
    id: "6",
    name: "Sachem",
    sector: "chemicals",
    dealType: "private_asset",
    sponsorFirm: "American Securities",
    description:
      "Specialty electronic and performance chemicals producer serving semiconductor and energy-storage markets.",
    confidence: "medium",
    currentStage: "in_market",
    daysInStage: 26,
    firstTracked: "2026-03-18",
    lastUpdated: "2026-05-07",
  },
  {
    id: "7",
    name: "Invista Nylon 6,6",
    sector: "chemicals",
    dealType: "carveout",
    parentCompany: "Koch Industries",
    description:
      "Integrated nylon 6,6 intermediates and polymer business periodically rumored as a portfolio candidate.",
    confidence: "low",
    currentStage: "on_hold",
    daysInStage: 64,
    firstTracked: "2025-12-01",
    lastUpdated: "2026-03-30",
  },
  {
    id: "8",
    name: "Valudor Products",
    sector: "specialty_materials",
    dealType: "private_asset",
    sponsorFirm: "Tilia Holdings",
    description:
      "Specialty inorganic and metal-derived chemistries serving coatings and catalysts customers.",
    confidence: "medium",
    currentStage: "in_market",
    daysInStage: 15,
    firstTracked: "2026-05-01",
    lastUpdated: "2026-05-18",
  },
  {
    id: "9",
    name: "Altivia",
    sector: "chemicals",
    dealType: "private_asset",
    sponsorFirm: "Reinvent Capital",
    description:
      "Phenol, acetone and water-treatment chemistries operator with Gulf Coast assets.",
    confidence: "high",
    currentStage: "monitor_for_exit",
    daysInStage: 95,
    firstTracked: "2025-09-22",
    lastUpdated: "2026-02-27",
  },
  {
    id: "10",
    name: "Miraclon",
    sector: "consumer_coatings",
    dealType: "carveout",
    parentCompany: "Montagu Private Equity",
    description:
      "Flexographic printing (KODAK FLEXCEL) business; ownership chatter has resurfaced amid sponsor portfolio rotation.",
    confidence: "needs_review",
    currentStage: "in_market",
    daysInStage: 5,
    firstTracked: "2026-05-28",
    lastUpdated: "2026-05-28",
  },
  {
    id: "11",
    name: "Shell Phenol Assets",
    sector: "energy_fuels",
    dealType: "carveout",
    parentCompany: "Shell plc",
    description:
      "Phenol and acetone production assets within Shell Chemicals flagged in downstream rationalization plans.",
    confidence: "medium",
    currentStage: "in_market",
    daysInStage: 19,
    firstTracked: "2026-04-20",
    lastUpdated: "2026-05-14",
  },
  {
    id: "12",
    name: "Braskem U.S. Assets",
    sector: "chemicals",
    dealType: "carveout",
    parentCompany: "Braskem S.A.",
    description:
      "Selected U.S. polypropylene assets discussed in connection with parent-level shareholder negotiations.",
    confidence: "low",
    currentStage: "on_hold",
    daysInStage: 48,
    firstTracked: "2025-11-15",
    lastUpdated: "2026-04-15",
  },
  {
    id: "13",
    name: "Nutrien Retail Brazil",
    sector: "agriculture",
    dealType: "carveout",
    parentCompany: "Nutrien Ltd.",
    description:
      "Brazilian ag-retail network; management has signaled openness to optimizing the international retail footprint.",
    confidence: "high",
    currentStage: "monitor_for_exit",
    daysInStage: 160,
    firstTracked: "2025-06-30",
    lastUpdated: "2025-12-24",
  },
  {
    id: "14",
    name: "Ascend Performance Materials",
    sector: "chemicals",
    dealType: "private_asset",
    sponsorFirm: "SK Capital Partners",
    description:
      "Fully integrated nylon 6,6 producer; restructuring activity has renewed interest in a sponsor transition.",
    confidence: "medium",
    currentStage: "in_market",
    daysInStage: 33,
    firstTracked: "2026-03-01",
    lastUpdated: "2026-04-30",
  },
  {
    id: "15",
    name: "Trinseo Engineered Polymers",
    sector: "specialty_materials",
    dealType: "carveout",
    parentCompany: "Trinseo PLC",
    description:
      "Engineered materials and compounds unit highlighted as a deleveraging candidate on recent earnings calls.",
    confidence: "needs_review",
    currentStage: "in_market",
    daysInStage: 2,
    firstTracked: "2026-05-31",
    lastUpdated: "2026-05-31",
  },
  {
    id: "16",
    name: "Hexion Coatings",
    sector: "consumer_coatings",
    dealType: "private_asset",
    sponsorFirm: "American Securities",
    description: "Coating resins and additives platform within the former Hexion estate.",
    confidence: "medium",
    currentStage: "monitor_for_exit",
    daysInStage: 120,
    firstTracked: "2025-08-30",
    lastUpdated: "2026-02-01",
  },
  {
    id: "17",
    name: "Olin Winchester Propellants",
    sector: "industrials",
    dealType: "carveout",
    parentCompany: "Olin Corporation",
    description:
      "Energetics and propellants line considered, then shelved, as Olin reaffirmed its commitment to the Winchester franchise.",
    confidence: "low",
    currentStage: "pulled",
    daysInStage: 38,
    firstTracked: "2025-10-12",
    lastUpdated: "2026-04-25",
  },
  {
    id: "18",
    name: "Lummus Technology",
    sector: "industrials",
    dealType: "private_asset",
    sponsorFirm: "Rhône Group",
    description:
      "Process-technology and catalyst licensing business; minority and full-exit scenarios both reported.",
    confidence: "high",
    currentStage: "in_market",
    daysInStage: 21,
    firstTracked: "2026-04-15",
    lastUpdated: "2026-05-12",
  },
  {
    id: "19",
    name: "Vertellus",
    sector: "specialty_materials",
    dealType: "private_asset",
    sponsorFirm: "Black Diamond Capital",
    description:
      "Specialty ingredients producer for agriculture, pharma and personal-care end markets.",
    confidence: "medium",
    currentStage: "in_market",
    daysInStage: 11,
    firstTracked: "2026-05-05",
    lastUpdated: "2026-05-22",
  },
  {
    id: "20",
    name: "W.R. Grace Catalysts",
    sector: "chemicals",
    dealType: "private_asset",
    sponsorFirm: "Standard Industries",
    description:
      "Refining and polyolefin catalysts technology business held under the Standard Industries umbrella.",
    confidence: "high",
    currentStage: "monitor_for_exit",
    daysInStage: 88,
    firstTracked: "2025-09-30",
    lastUpdated: "2026-03-05",
  },
  {
    id: "21",
    name: "ADAMA Crop Protection",
    sector: "agriculture",
    dealType: "private_asset",
    sponsorFirm: "Syngenta Group",
    description:
      "Off-patent crop-protection manufacturer; parent reorganization has prompted speculation on a carve-out or listing.",
    confidence: "medium",
    currentStage: "in_market",
    daysInStage: 29,
    firstTracked: "2026-03-22",
    lastUpdated: "2026-05-03",
  },
  {
    id: "22",
    name: "Phillips 66 Specialty Lubricants",
    sector: "energy_fuels",
    dealType: "carveout",
    parentCompany: "Phillips 66",
    description:
      "Finished lubricants and base-oil blending operations flagged by activist investors as a non-core unit.",
    confidence: "needs_review",
    currentStage: "on_hold",
    daysInStage: 12,
    firstTracked: "2026-05-15",
    lastUpdated: "2026-05-21",
  },
  {
    id: "23",
    name: "Lonza Specialty Ingredients",
    sector: "pharma_inputs",
    dealType: "private_asset",
    sponsorFirm: "Bain Capital & Cinven",
    description:
      "Microbial control and specialty chemicals platform (now Arxada); approaching the back half of the sponsor hold period.",
    confidence: "high",
    currentStage: "monitor_for_exit",
    daysInStage: 240,
    firstTracked: "2025-02-18",
    lastUpdated: "2025-10-05",
  },
  {
    id: "24",
    name: "Cabot Microelectronics",
    sector: "specialty_materials",
    dealType: "carveout",
    parentCompany: "Cabot Corporation",
    description:
      "CMP slurries and polishing-pad operations referenced in portfolio-shaping commentary.",
    confidence: "medium",
    currentStage: "in_market",
    daysInStage: 17,
    firstTracked: "2026-04-28",
    lastUpdated: "2026-05-15",
  },
];

export const mockWatchlist: string[] = ["1", "5", "13", "18", "23"];

// ---- stage history (explicit for several companies; synthesized otherwise) ----
const explicitHistory: Record<string, StageHistoryRecord[]> = {
  "1": [
    {
      id: "h1-3",
      companyId: "1",
      stage: "in_market",
      changedAt: "2026-04-21",
      changedBy: "system_auto",
      sourceType: "sec_filing",
      sourceUrl: "https://www.sec.gov/cgi-bin/browse-edgar",
      notes:
        "10-Q risk-factor language confirmed an active process for the polyurethanes unit.",
    },
    {
      id: "h1-2",
      companyId: "1",
      stage: "monitor_for_exit",
      changedAt: "2026-02-12",
      changedBy: "analyst_manual",
      sourceType: "earnings_transcript",
      sourceUrl: "https://example.com/dow-q4-2025-call",
      notes: "CEO described the unit as 'under strategic evaluation' on the Q4 call.",
    },
    {
      id: "h1-1",
      companyId: "1",
      stage: "in_market",
      changedAt: "2026-01-09",
      changedBy: "system_auto",
      sourceType: "google_news",
      sourceUrl: "https://example.com/news/dow-pu-review",
      notes: "Entered tracking universe following trade-press divestiture report.",
    },
  ],
  "2": [
    {
      id: "h2-3",
      companyId: "2",
      stage: "monitor_for_exit",
      changedAt: "2026-01-23",
      changedBy: "analyst_manual",
      sourceType: "manual",
      notes: "Analyst moved to monitor based on advisor mandate chatter.",
    },
    {
      id: "h2-2",
      companyId: "2",
      stage: "in_market",
      changedAt: "2025-10-30",
      changedBy: "system_auto",
      sourceType: "rss_feed",
      sourceUrl: "https://example.com/pe-wire/epsilyte",
      notes: "PE Wire noted sponsor had retained bankers.",
    },
    {
      id: "h2-1",
      companyId: "2",
      stage: "in_market",
      changedAt: "2025-08-14",
      changedBy: "system_auto",
      sourceType: "google_news",
      sourceUrl: "https://example.com/news/epsilyte-options",
      notes: "Entered tracking universe.",
    },
  ],
  "3": [
    {
      id: "h3-2",
      companyId: "3",
      stage: "in_market",
      changedAt: "2026-05-25",
      changedBy: "system_auto",
      sourceType: "sec_filing",
      sourceUrl: "https://www.sec.gov/cgi-bin/browse-edgar",
      notes: "20-F referenced a planned disposal of site-services operations.",
    },
    {
      id: "h3-1",
      companyId: "3",
      stage: "in_market",
      changedAt: "2026-05-04",
      changedBy: "system_auto",
      sourceType: "earnings_transcript",
      sourceUrl: "https://example.com/celanese-call",
      notes: "Entered tracking universe after deleveraging commentary.",
    },
  ],
  "4": [
    {
      id: "h4-1",
      companyId: "4",
      stage: "in_market",
      changedAt: "2026-05-30",
      changedBy: "system_auto",
      sourceType: "google_news",
      sourceUrl: "https://example.com/news/mosaic-brazil",
      notes:
        "Single-source press report; awaiting corroboration before raising confidence.",
    },
  ],
  "17": [
    {
      id: "h17-3",
      companyId: "17",
      stage: "pulled",
      changedAt: "2026-04-25",
      changedBy: "analyst_manual",
      sourceType: "earnings_transcript",
      sourceUrl: "https://example.com/olin-call",
      notes: "Management reaffirmed commitment to Winchester; process pulled.",
    },
    {
      id: "h17-2",
      companyId: "17",
      stage: "monitor_for_exit",
      changedAt: "2026-01-18",
      changedBy: "system_auto",
      sourceType: "google_news",
      sourceUrl: "https://example.com/news/olin-winchester",
      notes: "Trade press floated a propellants divestiture.",
    },
    {
      id: "h17-1",
      companyId: "17",
      stage: "in_market",
      changedAt: "2025-10-12",
      changedBy: "system_auto",
      sourceType: "rss_feed",
      sourceUrl: "https://example.com/rss/olin",
      notes: "Entered tracking universe.",
    },
  ],
};

export function getStageHistory(companyId: string): StageHistoryRecord[] {
  if (explicitHistory[companyId]) return explicitHistory[companyId];
  const c = mockCompanies.find((x) => x.id === companyId);
  if (!c) return [];
  // Synthesize a plausible 2-entry history from the current stage.
  return [
    {
      id: `${companyId}-cur`,
      companyId,
      stage: c.currentStage,
      changedAt: c.lastUpdated,
      changedBy: "system_auto",
      sourceType: c.dealType === "carveout" ? "sec_filing" : "rss_feed",
      sourceUrl: "https://www.sec.gov/cgi-bin/browse-edgar",
      notes: "Most recent stage confirmed by automated signal.",
    },
    {
      id: `${companyId}-init`,
      companyId,
      stage: "in_market",
      changedAt: c.firstTracked,
      changedBy: "system_auto",
      sourceType: "google_news",
      sourceUrl: "https://example.com/news",
      notes: "Entered tracking universe.",
    },
  ];
}

// ---- raw signals ----
const explicitSignals: Record<string, Signal[]> = {
  "1": [
    {
      id: "s1-1",
      companyId: "1",
      sourceType: "sec_filing",
      sourceUrl: "https://www.sec.gov/cgi-bin/browse-edgar",
      title: "Dow Inc. — Form 10-Q (Q1 2026)",
      excerpt:
        "The Company is pursuing strategic alternatives for its polyurethanes business, which may include a sale, and has engaged financial advisors.",
      ingestedAt: "2026-04-21",
    },
    {
      id: "s1-2",
      companyId: "1",
      sourceType: "earnings_transcript",
      sourceUrl: "https://example.com/dow-q4-2025-call",
      title: "Dow Q4 2025 earnings call",
      excerpt:
        "“We continue to evaluate the best ownership structure for the propylene oxide and polyurethanes franchise.”",
      ingestedAt: "2026-02-12",
    },
    {
      id: "s1-3",
      companyId: "1",
      sourceType: "google_news",
      sourceUrl: "https://example.com/news/dow-pu-review",
      title: "Trade press: Dow weighs polyurethanes sale",
      excerpt:
        "People familiar with the matter say a first round of bids could be solicited by mid-year.",
      ingestedAt: "2026-01-09",
    },
  ],
  "2": [
    {
      id: "s2-1",
      companyId: "2",
      sourceType: "rss_feed",
      sourceUrl: "https://example.com/pe-wire/epsilyte",
      title: "PE Wire — Arsenal explores EPSilyte options",
      excerpt:
        "Arsenal Capital is said to have retained an adviser to explore a sale of EPSilyte after a multi-year hold.",
      ingestedAt: "2025-10-30",
    },
    {
      id: "s2-2",
      companyId: "2",
      sourceType: "google_news",
      sourceUrl: "https://example.com/news/epsilyte-options",
      title: "EPS market outlook cites consolidation",
      excerpt:
        "Analysts expect continued consolidation among North American EPS producers over the next 18 months.",
      ingestedAt: "2025-08-14",
    },
  ],
  "4": [
    {
      id: "s4-1",
      companyId: "4",
      sourceType: "google_news",
      sourceUrl: "https://example.com/news/mosaic-brazil",
      title: "Report: Mosaic studies Brazil distribution sale",
      excerpt:
        "A local outlet reported that Mosaic is weighing a sale of certain Brazilian blending and distribution assets. The company declined to comment.",
      ingestedAt: "2026-05-30",
    },
  ],
};

export function getSignals(companyId: string): Signal[] {
  if (explicitSignals[companyId]) return explicitSignals[companyId];
  const c = mockCompanies.find((x) => x.id === companyId);
  if (!c) return [];
  return [
    {
      id: `${companyId}-sig1`,
      companyId,
      sourceType: c.dealType === "carveout" ? "sec_filing" : "rss_feed",
      sourceUrl: "https://www.sec.gov/edgar/search/",
      title: `${c.name} — primary signal`,
      sourceName: c.dealType === "carveout" ? "SEC 8-K" : "PE Wire",
      excerpt:
        "Advisers are reported to have been engaged to evaluate options; a process could launch in the coming quarters.",
      rawExcerpt:
        "The company today announced it has retained financial advisers to evaluate a range of strategic alternatives for the business, including a potential sale or separation. No assurance can be given that the review will result in any transaction.",
      reasoning:
        "Explicit mention of engaged advisers + 'strategic alternatives' from a primary filing indicates an active in-market process.",
      ingestedAt: c.lastUpdated,
    },
    {
      id: `${companyId}-sig2`,
      companyId,
      sourceType: "google_news",
      sourceUrl: "https://example.com/news",
      title: `${c.name} — corroborating coverage`,
      sourceName: "Bloomberg",
      excerpt:
        "Trade coverage echoed interest from strategic and financial buyers in the asset.",
      rawExcerpt:
        "People familiar with the matter said several private equity firms and strategic acquirers have expressed early interest, though a formal process has not yet launched.",
      reasoning:
        "Secondary press corroboration raises corroboration but is single-sourced and not yet a formal process.",
      ingestedAt: c.firstTracked,
    },
  ];
}

// ---- analyst notes ----
const explicitNotes: Record<string, Note[]> = {
  "1": [
    {
      id: "n1-1",
      companyId: "1",
      author: "Priya Nair",
      initials: "PN",
      content:
        "Spoke with a sell-side contact — expectation is a teaser by end of Q2. Strategics in PU are limited, so this likely skews to sponsors.",
      createdAt: "2026-05-18",
    },
    {
      id: "n1-2",
      companyId: "1",
      author: "Marcus Hale",
      initials: "MH",
      content:
        "Watch the PO/PG integration — buyers will care about feedstock contracts post-separation.",
      createdAt: "2026-03-02",
    },
  ],
  "5": [
    {
      id: "n5-1",
      companyId: "5",
      author: "Priya Nair",
      initials: "PN",
      content:
        "SK has held GEON since 2019; a 2026 process would be right in the fairway. Keeping on the front burner.",
      createdAt: "2026-01-11",
    },
  ],
};

export function getNotes(companyId: string): Note[] {
  return explicitNotes[companyId] ?? [];
}

export function getCompany(companyId: string): Company | undefined {
  return mockCompanies.find((c) => c.id === companyId);
}

export function getSectorPeers(companyId: string, limit = 4): Company[] {
  const c = getCompany(companyId);
  if (!c) return [];
  return mockCompanies
    .filter((x) => x.sector === c.sector && x.id !== c.id)
    .slice(0, limit);
}

export function getComps(companyId: string, limit = 5): CompResult[] {
  const c = getCompany(companyId);
  if (!c) return [];
  const target: CompInput = {
    id: c.id,
    name: c.name,
    sector: c.sector,
    dealType: c.dealType,
    stage: c.currentStage,
    revenue: c.revenue,
    ebitda: c.ebitda,
    outcome: c.outcome,
  };
  const candidates: CompInput[] = mockCompanies.map((mc) => ({
    id: mc.id,
    name: mc.name,
    sector: mc.sector,
    dealType: mc.dealType,
    stage: mc.currentStage,
    revenue: mc.revenue,
    ebitda: mc.ebitda,
    outcome: mc.outcome,
    closedAt: mc.closedAt ?? null,
    closeMultiple: mc.closeMultiple ?? null,
  }));
  return topComps(target, candidates, limit);
}

// ---- feed events (last 7 days; today = 2026-06-02) ----
export const mockFeedEvents: FeedEvent[] = [
  // today
  {
    id: "e1",
    type: "new_entry",
    companyId: "15",
    toStage: "in_market",
    action: "added to the radar as a new in-market carveout",
    timestamp: "2026-06-02T09:12:00",
    sourceType: "earnings_transcript",
    sourceUrl: "https://example.com/trinseo-call",
    excerpt:
      "“We are exploring options for our engineered polymers portfolio, including a potential separation.”",
  },
  {
    id: "e2",
    type: "moved_monitor",
    companyId: "20",
    fromStage: "in_market",
    toStage: "monitor_for_exit",
    action: "moved from In market to Monitor for exit",
    timestamp: "2026-06-02T08:41:00",
    sourceType: "rss_feed",
    sourceUrl: "https://example.com/rss/grace-catalysts",
  },
  {
    id: "e3",
    type: "flagged",
    companyId: "10",
    toStage: "in_market",
    action: "flagged — low-confidence signal needs analyst review",
    timestamp: "2026-06-02T07:55:00",
    sourceType: "google_news",
    sourceUrl: "https://example.com/news/miraclon",
    flagged: true,
  },
  {
    id: "e4",
    type: "moved_in_market",
    companyId: "3",
    fromStage: "monitor_for_exit",
    toStage: "in_market",
    action: "moved from Monitor for exit to In market",
    timestamp: "2026-06-02T06:30:00",
    sourceType: "sec_filing",
    sourceUrl: "https://www.sec.gov/cgi-bin/browse-edgar",
    excerpt:
      "Form 20-F: “The Group intends to dispose of its site-services operations within the next twelve months.”",
  },
  // yesterday
  {
    id: "e5",
    type: "new_entry",
    companyId: "4",
    toStage: "in_market",
    action: "added to the radar (needs review)",
    timestamp: "2026-06-01T16:20:00",
    sourceType: "google_news",
    sourceUrl: "https://example.com/news/mosaic-brazil",
    flagged: true,
  },
  {
    id: "e6",
    type: "pulled",
    companyId: "17",
    fromStage: "monitor_for_exit",
    toStage: "pulled",
    action: "process pulled — parent reaffirmed it will retain the unit",
    timestamp: "2026-06-01T14:02:00",
    sourceType: "earnings_transcript",
    sourceUrl: "https://example.com/olin-call",
    excerpt:
      "“Winchester is core to Olin and we have no intention of divesting the propellants operations.”",
  },
  {
    id: "e7",
    type: "moved_monitor",
    companyId: "13",
    fromStage: "in_market",
    toStage: "monitor_for_exit",
    action: "moved from In market to Monitor for exit",
    timestamp: "2026-06-01T11:48:00",
    sourceType: "rss_feed",
    sourceUrl: "https://example.com/rss/nutrien",
  },
  {
    id: "e8",
    type: "moved_in_market",
    companyId: "18",
    fromStage: "monitor_for_exit",
    toStage: "in_market",
    action: "moved from Monitor for exit to In market",
    timestamp: "2026-06-01T09:05:00",
    sourceType: "google_news",
    sourceUrl: "https://example.com/news/lummus",
  },
  // two days ago
  {
    id: "e9",
    type: "new_entry",
    companyId: "8",
    toStage: "in_market",
    action: "added to the radar as a new in-market private asset",
    timestamp: "2026-05-31T15:33:00",
    sourceType: "rss_feed",
    sourceUrl: "https://example.com/rss/valudor",
  },
  {
    id: "e10",
    type: "moved_on_hold",
    companyId: "22",
    fromStage: "in_market",
    toStage: "on_hold",
    action: "moved from In market to On hold",
    timestamp: "2026-05-31T13:10:00",
    sourceType: "manual",
    sourceUrl: "https://example.com/internal",
  },
  {
    id: "e11",
    type: "flagged",
    companyId: "12",
    action: "flagged — signal contradicts current stage",
    timestamp: "2026-05-31T10:25:00",
    sourceType: "google_news",
    sourceUrl: "https://example.com/news/braskem",
    flagged: true,
  },
  // three days ago
  {
    id: "e12",
    type: "moved_in_market",
    companyId: "24",
    fromStage: "monitor_for_exit",
    toStage: "in_market",
    action: "moved from Monitor for exit to In market",
    timestamp: "2026-05-30T12:00:00",
    sourceType: "sec_filing",
    sourceUrl: "https://www.sec.gov/cgi-bin/browse-edgar",
  },
  {
    id: "e13",
    type: "new_entry",
    companyId: "19",
    toStage: "in_market",
    action: "added to the radar as a new in-market private asset",
    timestamp: "2026-05-30T08:44:00",
    sourceType: "rss_feed",
    sourceUrl: "https://example.com/rss/vertellus",
  },
  // four days ago
  {
    id: "e14",
    type: "moved_monitor",
    companyId: "16",
    fromStage: "in_market",
    toStage: "monitor_for_exit",
    action: "moved from In market to Monitor for exit",
    timestamp: "2026-05-29T17:15:00",
    sourceType: "google_news",
    sourceUrl: "https://example.com/news/hexion",
  },
  {
    id: "e15",
    type: "moved_in_market",
    companyId: "6",
    fromStage: "monitor_for_exit",
    toStage: "in_market",
    action: "moved from Monitor for exit to In market",
    timestamp: "2026-05-29T09:30:00",
    sourceType: "rss_feed",
    sourceUrl: "https://example.com/rss/sachem",
  },
];

// ---- review queue ----
export const mockReviewItems: ReviewItem[] = [
  {
    companyId: "4",
    reason: "Low-confidence new entry",
    conflictSummary:
      "Single local-press source reports a Brazil asset sale; no corroborating filing or transcript.",
  },
  {
    companyId: "10",
    reason: "Conflicting signals",
    conflictSummary:
      "News item implies an active process, but the sponsor's last statement denied any sale plans.",
  },
  {
    companyId: "15",
    reason: "Low-confidence new entry",
    conflictSummary:
      "Transcript language is exploratory (“considering options”) — stage may be premature.",
  },
  {
    companyId: "22",
    reason: "Signal contradicts current stage",
    conflictSummary:
      "Marked On hold, but an activist letter this week pushes for an immediate sale.",
  },
  {
    companyId: "12",
    reason: "Signal contradicts current stage",
    conflictSummary:
      "On hold per parent negotiations, yet a new report describes buyer outreach.",
  },
  {
    companyId: "7",
    reason: "Stale low-confidence signal",
    conflictSummary:
      "On hold for 64 days with no fresh corroboration; confidence has decayed.",
  },
  {
    companyId: "11",
    reason: "Ambiguous entity match",
    conflictSummary:
      "Signal may reference Shell's Singapore assets rather than the tracked phenol unit.",
  },
  {
    companyId: "21",
    reason: "Conflicting signals",
    conflictSummary:
      "Carve-out vs. IPO paths reported by different outlets; deal type uncertain.",
  },
];

// ---- analytics series ----
export interface VelocityWeek {
  week: string;
  carveout: number;
  private_asset: number;
}

// 26 weeks of synthetic velocity data.
export const mockVelocity: VelocityWeek[] = Array.from({ length: 26 }).map((_, i) => {
  const seedA = (i * 7 + 3) % 9;
  const seedB = (i * 5 + 2) % 7;
  return {
    week: `W${i + 1}`,
    carveout: 2 + seedA,
    private_asset: 1 + seedB,
  };
});

export const mockDealSplit = [
  { name: "Carveouts", value: 58 },
  { name: "Private assets", value: 42 },
];

export interface SectorStageRow {
  sector: string;
  in_market: number;
  monitor: number;
  on_hold: number;
}

export const mockSectorStage: SectorStageRow[] = [
  { sector: "Chemicals", in_market: 14, monitor: 6, on_hold: 3 },
  { sector: "Specialty materials", in_market: 9, monitor: 5, on_hold: 1 },
  { sector: "Agriculture", in_market: 7, monitor: 4, on_hold: 2 },
  { sector: "Industrials", in_market: 6, monitor: 2, on_hold: 4 },
  { sector: "Energy & fuels", in_market: 5, monitor: 1, on_hold: 2 },
  { sector: "Consumer & coatings", in_market: 4, monitor: 3, on_hold: 1 },
  { sector: "Pharma inputs", in_market: 3, monitor: 2, on_hold: 0 },
];

export const mockExitFunnel = [
  { stage: "Monitor for exit", days: 287 },
  { stage: "In market", days: 47 },
  { stage: "Pulled", days: 38 },
];

export const mockTopSectors = [
  { sector: "Specialty materials", days: 63 },
  { sector: "Agriculture", days: 51 },
  { sector: "Chemicals", days: 47 },
  { sector: "Industrials", days: 39 },
  { sector: "Energy & fuels", days: 31 },
];

// ---- admin ----
export const mockUsers = [
  {
    name: "Priya Nair",
    email: "priya.nair@arbor.example",
    role: "Analyst",
    lastActive: "2 minutes ago",
  },
  {
    name: "Marcus Hale",
    email: "marcus.hale@arbor.example",
    role: "Analyst",
    lastActive: "1 hour ago",
  },
  {
    name: "Dana Whitfield",
    email: "dana.whitfield@arbor.example",
    role: "Admin",
    lastActive: "Yesterday",
  },
  {
    name: "Sam Okafor",
    email: "sam.okafor@arbor.example",
    role: "Admin",
    lastActive: "3 days ago",
  },
];

// ---- contacts / banker relationship layer ----
export const mockContacts: Contact[] = [
  {
    id: "ct1",
    name: "Daniel Reyes",
    title: "Managing Director, M&A",
    firm: "Goldman Sachs",
    email: "d.reyes@gs.example",
    phone: "+1 212-555-0142",
    linkedinUrl: "https://linkedin.com/in/danielreyes",
    notes: "Lead banker on the Dow Polyurethanes carve-out. Responsive, prefers email.",
    createdAt: "2026-03-18",
  },
  {
    id: "ct2",
    name: "Aisha Bello",
    title: "Partner",
    firm: "Jefferies",
    email: "a.bello@jefferies.example",
    phone: null,
    linkedinUrl: null,
    notes: "Running the Nouryon Surfactants process.",
    createdAt: "2026-04-02",
  },
  {
    id: "ct3",
    name: "Tom Halloran",
    title: "Director",
    firm: "Houlihan Lokey",
    email: "t.halloran@hl.example",
    phone: "+1 310-555-0190",
    linkedinUrl: null,
    notes: "GEON sale process. First-round bids late Q3.",
    createdAt: "2026-05-16",
  },
  {
    id: "ct4",
    name: "Margaret Chen",
    title: "Chief Financial Officer",
    firm: "Sachem",
    email: "m.chen@sachem.example",
    phone: null,
    linkedinUrl: null,
    notes: "Direct line to management on the Sachem asset.",
    createdAt: "2026-05-21",
  },
  {
    id: "ct5",
    name: "Robert Vance",
    title: "Managing Director",
    firm: "Goldman Sachs",
    email: "r.vance@gs.example",
    phone: null,
    linkedinUrl: null,
    notes: "Covers industrials carve-outs alongside Daniel.",
    createdAt: "2026-04-29",
  },
  {
    id: "ct6",
    name: "Elena Petrova",
    title: "Partner, Corporate",
    firm: "Kirkland & Ellis",
    email: "e.petrova@kirkland.example",
    phone: null,
    linkedinUrl: null,
    notes: "Deal counsel on multiple sponsor exits.",
    createdAt: "2026-03-30",
  },
];

// company id -> attached contacts (with link id + role).
const MOCK_COMPANY_CONTACTS: Record<string, CompanyContact[]> = {
  "1": [
    { ...mockContacts[0]!, linkId: "lc1", role: "M&A Advisor" },
    { ...mockContacts[4]!, linkId: "lc2", role: "M&A Advisor" },
    { ...mockContacts[5]!, linkId: "lc3", role: "Counsel" },
  ],
  "6": [{ ...mockContacts[3]!, linkId: "lc4", role: "CFO" }],
  "5": [{ ...mockContacts[2]!, linkId: "lc5", role: "M&A Advisor" }],
};

export function getCompanyContacts(companyId: string): CompanyContact[] {
  return MOCK_COMPANY_CONTACTS[companyId] ?? [];
}

// Banker intelligence over the mock links (mirrors /api/contacts/firms).
export const mockFirmActivity = bankerIntelligence(
  Object.entries(MOCK_COMPANY_CONTACTS).flatMap(([companyId, links]) =>
    links.map((l) => ({ companyId, firm: l.firm, role: l.role }))
  )
);

// Flat company_contact links for the relationship graph (coverage + warm intros).
export const mockContactLinks: ContactLink[] = Object.entries(
  MOCK_COMPANY_CONTACTS
).flatMap(([companyId, links]) =>
  links.map((l) => ({ contactId: l.id, companyId, role: l.role }))
);

// ---- mock bids ----
const MOCK_BIDS: Record<string, Bid[]> = {
  "1": [
    {
      id: "bid-1-a",
      companyId: "1",
      userId: "mock-user",
      orgId: null,
      bidType: "indicative",
      round: "1",
      bidDate: "2026-05-15",
      amountUsd: 420,
      multipleOnEbitda: 10.5,
      rationale: "Strong sector tailwinds; management quality above average.",
      createdAt: "2026-05-15T10:00:00Z",
    },
    {
      id: "bid-1-b",
      companyId: "1",
      userId: "mock-user",
      orgId: null,
      bidType: "final",
      round: "2",
      bidDate: "2026-06-01",
      amountUsd: 445,
      multipleOnEbitda: 11.1,
      rationale: "Increased conviction post-management presentation.",
      createdAt: "2026-06-01T14:30:00Z",
    },
  ],
};

export function getMockBids(companyId: string): Bid[] {
  return MOCK_BIDS[companyId] ?? [];
}

// ---- mock pipeline deals (derived from radar companies with process stages) ----
import { baseRadarCompanies } from "./radar-data";

export function getMockPipelineDeals(): PipelineDeal[] {
  return baseRadarCompanies
    .filter((c) => c.ourProcessStage)
    .map((c, i) => {
      const compBids = c.companyId ? (MOCK_BIDS[c.companyId] ?? []) : [];
      const multipleAvg =
        compBids.length > 0
          ? compBids.reduce((s, b) => s + (b.multipleOnEbitda ?? 0), 0) /
              compBids.filter((b) => b.multipleOnEbitda !== null).length || null
          : null;
      return {
        companyId: c.companyId ?? c.id,
        companyName: c.name,
        sector: c.sector,
        dealType: c.dealType,
        ourProcessStage: c.ourProcessStage!,
        keyDates: c.processKeyDates ?? {},
        daysInStage: [12, 5, 18, 3, 30, 8, 45, 2][i % 8]!,
        ownerId: null,
        ownerEmail: null,
        bidCount: compBids.length,
        avgBidMultiple: multipleAvg ?? null,
      } satisfies PipelineDeal;
    });
}

// ---- funds / LP reporting (mock mode) -------------------------------------

export interface MockFund extends LpFund {
  dealCount: number;
}

export const mockFunds: MockFund[] = [
  { id: "fund-growth-iv", name: "Arbor Growth Fund IV", vintageYear: 2024, dealCount: 0 },
  { id: "fund-buyout-ii", name: "Arbor Buyout Fund II", vintageYear: 2021, dealCount: 0 },
];

// Assign the first tracked companies to the two funds, round-robin, so the LP
// report has populated sections in mock mode.
const mockLpDeals: LpDeal[] = mockCompanies.slice(0, 8).map((c, i) => ({
  companyId: c.id,
  companyName: c.name,
  sector: c.sector,
  fundId: i % 3 === 2 ? null : mockFunds[i % 2]!.id,
  stage: c.currentStage,
  conviction: [82, 64, 48, 71, 55, 90, 38, 60][i % 8]!,
  bidCount: [2, 0, 1, 3, 0, 1, 0, 2][i % 8]!,
  createdAt: c.firstTracked,
}));

for (const d of mockLpDeals) {
  const f = mockFunds.find((x) => x.id === d.fundId);
  if (f) f.dealCount += 1;
}

export const mockLpReport = buildLpReport(
  mockLpDeals,
  mockFunds.map(({ id, name, vintageYear }) => ({ id, name, vintageYear })),
  currentQuarter()
);
