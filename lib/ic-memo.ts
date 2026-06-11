// Structured IC (investment committee) memo. Unlike the free-form deal brief in
// lib/memo.ts, this produces a fixed set of titled sections suitable for an IC
// pack. The prompt builders, parser, and markdown formatter are pure and
// unit-tested; the LLM call is dormant until ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { withRetry } from "@/lib/retry";
import { withSpan } from "@/lib/trace";
import { waitForLlmSlot } from "@/lib/redis/ratelimit";
import { hasAnthropicEnv } from "@/lib/extract-signal";
import { buildContext, truncate } from "@/lib/memo";
import type { Company, Signal } from "@/lib/types";
import type { CompResult } from "@/lib/comps";
import { PROCESS_STAGE_LABELS, type OurProcessStage } from "@/lib/process-stage";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

// Canonical section order. `key` is the uppercase header the model must emit;
// `title` is the display heading.
export const IC_SECTIONS: { key: string; title: string }[] = [
  { key: "EXECUTIVE SUMMARY", title: "Executive Summary" },
  { key: "BUSINESS DESCRIPTION", title: "Business Description" },
  { key: "INVESTMENT THESIS", title: "Investment Thesis" },
  { key: "KEY RISKS", title: "Key Risks" },
  { key: "COMPARABLE TRANSACTIONS", title: "Comparable Transactions" },
  { key: "PROCESS STATUS", title: "Process Status" },
  { key: "CONVICTION & SIGNALS", title: "Conviction & Signals" },
  { key: "RECOMMENDATION", title: "Recommendation" },
];

export interface IcMemoSection {
  title: string;
  body: string;
}

export const IC_MEMO_SYSTEM = `You are a private-equity analyst drafting an internal Investment Committee (IC) memo from tracked divestiture signals and deal context.
Write these sections IN THIS ORDER, each header on its own line in UPPERCASE exactly as shown, followed by 2-5 sentences (or short dashed bullet lines where natural):
EXECUTIVE SUMMARY — the opportunity in brief: what is for sale, why now, our posture.
BUSINESS DESCRIPTION — what the company does, sector, scale.
INVESTMENT THESIS — why this could be attractive; value-creation angles.
KEY RISKS — diligence gaps, single-source signals, execution and market risks.
COMPARABLE TRANSACTIONS — relevant comps from the provided list; note multiples if present, else state limited comparables.
PROCESS STATUS — our internal process stage and what it implies for timing/access.
CONVICTION & SIGNALS — strength and corroboration of the evidence; name source types.
RECOMMENDATION — a clear next action (e.g. progress to NDA, pass, monitor) with one-line rationale.
Rules: rely ONLY on the provided facts, signals, process status, and comparables; never invent advisers, prices, or buyers. Be factual and concise. Plain text only — no markdown, no bold, no numbering of sections.`;

// Pure: render the comps list for the prompt context.
function compsContext(comps: CompResult[]): string {
  if (!comps.length) return "Comparable transactions: none on file.";
  const lines = comps
    .slice(0, 6)
    .map((c, i) => {
      const bits = [
        c.name,
        c.sector,
        c.revenue ? `rev ${c.revenue}` : null,
        c.ebitda ? `ebitda ${c.ebitda}` : null,
        c.outcome ?? null,
      ].filter(Boolean);
      return `${i + 1}. ${bits.join(" · ")}`;
    })
    .join("\n");
  return `Comparable transactions (same sector / deal type):\n${lines}`;
}

// Pure: assemble the full user prompt — reuses the deal-brief context, then
// layers in internal process status and comparables.
export function buildIcContext(
  company: Company,
  signals: Signal[],
  processStage: OurProcessStage | null,
  comps: CompResult[]
): string {
  const base = buildContext(company, signals);
  const process = processStage
    ? `Our internal process stage: ${PROCESS_STAGE_LABELS[processStage]}`
    : "Our internal process stage: not set (market signal only).";
  return `${base}\n\n${process}\n\n${compsContext(comps)}`;
}

// Stable fingerprint — memo regenerates when signals, process stage, or comp set
// change. Mirrors lib/memo.ts memoSignalsHash but folds in the extra inputs.
export function icMemoHash(
  signals: Signal[],
  processStage: OurProcessStage | null,
  comps: CompResult[]
): string {
  const basis = [
    ...signals.map((s) => `${s.id}:${s.ingestedAt}`).sort(),
    `stage:${processStage ?? "none"}`,
    `comps:${comps
      .map((c) => c.id)
      .sort()
      .join(",")}`,
  ].join("|");
  return createHash("sha256").update(basis).digest("hex");
}

// Pure: split the model's plain-text output into canonical sections. Unknown
// content before the first header is ignored; missing sections come back empty.
export function parseIcMemo(raw: string): IcMemoSection[] {
  const text = (raw ?? "").trim();
  // Find each header's position, then slice content between consecutive headers.
  const marks: { idx: number; len: number; title: string }[] = [];
  for (const { key, title } of IC_SECTIONS) {
    // Header at line start, optionally followed by an em/hyphen separator.
    const re = new RegExp(`^${key.replace(/&/g, "\\&")}\\s*[—:-]?\\s*`, "im");
    const m = re.exec(text);
    if (m) marks.push({ idx: m.index, len: m[0].length, title });
  }
  marks.sort((a, b) => a.idx - b.idx);

  const byTitle = new Map<string, string>();
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].idx + marks[i].len;
    const end = i + 1 < marks.length ? marks[i + 1].idx : text.length;
    byTitle.set(marks[i].title, text.slice(start, end).trim());
  }

  return IC_SECTIONS.map(({ title }) => ({ title, body: byTitle.get(title) ?? "" }));
}

// Pure: render parsed sections as Markdown for copy / download.
export function formatIcMemoMarkdown(
  company: Company,
  sections: IcMemoSection[],
  generatedAt: string
): string {
  const header = `# IC Memo — ${company.name}\n\n_Generated ${generatedAt.slice(0, 10)} · AI-drafted, verify before acting._\n`;
  const body = sections
    .filter((s) => s.body)
    .map((s) => `## ${s.title}\n\n${s.body}`)
    .join("\n\n");
  return `${header}\n${body}\n`;
}

async function complete(system: string, userText: string): Promise<string | null> {
  if (!hasAnthropicEnv()) return null;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  try {
    await waitForLlmSlot();
    const res = await withSpan("llm.ic-memo", "gen_ai.invoke_agent", () =>
      withRetry(() =>
        client.messages.create({
          model: MODEL,
          max_tokens: 1400,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: userText }],
        })
      )
    );
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : null;
  } catch {
    return null;
  }
}

// Generate the raw IC memo text. Null = dormant or transient failure.
export function generateIcMemo(
  company: Company,
  signals: Signal[],
  processStage: OurProcessStage | null,
  comps: CompResult[]
): Promise<string | null> {
  const userText = truncate(buildIcContext(company, signals, processStage, comps), 12000);
  return complete(IC_MEMO_SYSTEM, userText);
}
