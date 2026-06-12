// AI deal brief + company Q&A. Builds prompts from a company + its stored signals
// (no embeddings needed — a single company's signal history fits the context) and
// calls Claude through the shared extraction plumbing. Dormant until
// ANTHROPIC_API_KEY: generateMemo / answerQuestion return null, callers show a
// "configure" state. The prompt builders + signals hash are pure and unit-tested.

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { withRetry } from "@/lib/retry";
import { withSpan } from "@/lib/trace";
import { waitForLlmSlot } from "@/lib/redis/ratelimit";
import { hasAnthropicEnv } from "@/lib/extract-signal";
import type { Company, Signal } from "@/lib/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export function truncate(text: string, max: number): string {
  const t = (text ?? "").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

// Stable fingerprint of the signal set — lets the route cache a memo and skip
// regeneration (and the LLM spend) until the underlying signals change.
export function memoSignalsHash(signals: Signal[]): string {
  const basis = signals
    .map((s) => `${s.id}:${s.ingestedAt}`)
    .sort()
    .join("|");
  return createHash("sha256").update(basis).digest("hex");
}

// Pure: company facts + signals → the user prompt shared by the memo and Q&A.
export function buildContext(company: Company, signals: Signal[]): string {
  const owner =
    company.dealType === "carveout" ? company.parentCompany : company.sponsorFirm;
  const facts = [
    `Company: ${company.name}`,
    `Sector: ${company.sector}${company.subsector ? ` / ${company.subsector}` : ""}`,
    `Deal type: ${company.dealType}`,
    `${company.dealType === "carveout" ? "Parent" : "Sponsor"}: ${owner ?? "Undisclosed"}`,
    `Current stage: ${company.currentStage} (${company.daysInStage} days in stage)`,
    `Extraction confidence: ${company.confidence}`,
    company.revenue ? `Revenue: ${company.revenue}` : null,
    company.ebitda ? `EBITDA: ${company.ebitda}` : null,
    company.margin ? `Margin: ${company.margin}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const sigLines = signals.length
    ? signals
        .map(
          (s, i) =>
            `${i + 1}. [${s.sourceType}${s.sourceName ? ` · ${s.sourceName}` : ""}] ` +
            `${truncate(s.excerpt || s.rawExcerpt || "", 400)} (${s.ingestedAt.slice(0, 10)})`
        )
        .join("\n")
    : "No signals recorded yet.";

  return `Company facts:\n${facts}\n\nSignals (newest first):\n${sigLines}`;
}

export const MEMO_SYSTEM = `You are a private-equity analyst writing a concise internal deal brief from tracked divestiture signals.
Write exactly these four sections, each header on its own line followed by 1-3 short sentences:
SITUATION — what is happening and at what stage of a potential sale.
EVIDENCE — the strongest signals; name the source types and flag if single-sourced or low-confidence.
CONSIDERATIONS — risks, gaps, and what to verify before acting.
NEXT STEPS — concrete actions for the deal team.
Rules: rely only on the provided facts and signals; never invent advisers, prices, or buyers. Be terse and factual. Plain text only — no markdown, no bold.`;

export const QA_SYSTEM = `You are a private-equity analyst assistant. Answer the analyst's question using ONLY the company facts and signals provided. If the answer is not supported by them, say so plainly rather than guessing. Be concise (1-3 sentences). Plain text, no markdown.`;

async function complete(
  system: string,
  userText: string,
  span: string,
  maxTokens: number
): Promise<string | null> {
  if (!hasAnthropicEnv()) return null;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  try {
    await waitForLlmSlot();
    const res = await withSpan(span, "gen_ai.invoke_agent", () =>
      withRetry(() =>
        client.messages.create({
          model: MODEL,
          max_tokens: maxTokens,
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

export function generateMemo(
  company: Company,
  signals: Signal[]
): Promise<string | null> {
  return complete(MEMO_SYSTEM, buildContext(company, signals), "llm.memo", 700);
}

export function answerQuestion(
  company: Company,
  signals: Signal[],
  question: string
): Promise<string | null> {
  const userText = `${buildContext(company, signals)}\n\nAnalyst question: ${truncate(question, 500)}`;
  return complete(QA_SYSTEM, userText, "llm.qa", 350);
}

// ---- Q&A with citations ----

export const QA_CITATIONS_SYSTEM = `You are a private-equity analyst assistant. Answer the analyst's question using ONLY the company facts and signals provided.
Respond in exactly this format:
ANSWER: <concise answer in 1–3 sentences. If the answer isn't supported by the provided data, say so plainly.>
CITATIONS: <comma-separated signal numbers you cited, e.g. 1, 3 — or NONE if no signals were cited>`;

export interface Citation {
  signalId: string;
  quote: string;
  sourceType: string;
  sourceName: string | null;
  ingestedAt: string;
}

export async function answerQuestionWithCitations(
  company: Company,
  signals: Signal[],
  question: string
): Promise<{ answer: string | null; citations: Citation[]; configured: boolean }> {
  if (!hasAnthropicEnv()) return { answer: null, citations: [], configured: false };

  const context = buildContext(company, signals);
  const userText = `${context}\n\nAnalyst question: ${truncate(question, 500)}`;
  const raw = await complete(QA_CITATIONS_SYSTEM, userText, "llm.qa-citations", 500);
  if (raw === null) return { answer: null, citations: [], configured: true };

  // Parse the structured response.
  const answerMatch = raw.match(/^ANSWER:\s*([\s\S]*?)(?=\nCITATIONS:|$)/m);
  const citMatch = raw.match(/^CITATIONS:\s*(.+)$/m);
  const answer = (answerMatch?.[1] ?? raw).trim();

  const citRaw = citMatch?.[1]?.trim() ?? "";
  const citNums =
    citRaw === "NONE" || citRaw === ""
      ? []
      : citRaw
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));

  const citations: Citation[] = citNums
    .filter((n) => n >= 1 && n <= signals.length)
    .map((n) => {
      const s = signals[n - 1]!;
      return {
        signalId: s.id,
        quote: truncate(s.excerpt || s.rawExcerpt || "", 200),
        sourceType: s.sourceType,
        sourceName: s.sourceName ?? null,
        ingestedAt: s.ingestedAt,
      };
    });

  return { answer, citations, configured: true };
}
