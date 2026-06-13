// LLM signal extraction — shared by both ingestion pipelines.
// Structured output via a forced tool call, exponential backoff, prompt
// caching on the system prompt, best-effort usage logging. Returns null only
// on hard failure (no key / API error / unparseable) — never throws to callers.

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { waitForLlmSlot } from "@/lib/redis/ratelimit";
import { withRetry } from "@/lib/retry";
import { withSpan } from "@/lib/trace";
import { wrapUntrusted, UNTRUSTED_GUARD } from "@/lib/llm-safety";
import type { DealType, Stage, Confidence, SourceType, Sector } from "@/lib/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_TOKENS = 600;

export interface ExtractInput {
  rawText: string;
  sourceType: SourceType;
}

export interface ExtractedSignal {
  found: boolean;
  company_name?: string;
  parent_company?: string | null;
  sponsor_firm?: string | null;
  sector?: Sector;
  deal_type?: DealType;
  stage?: Stage;
  confidence?: Confidence;
  key_quote?: string;
  reasoning?: string;
  // financials (when stated in the source) — feed the asset card / company page
  revenue?: string;
  ebitda?: string;
  margin?: string;
  deal_size?: string;
}

export function hasAnthropicEnv(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `You are an M&A signal extractor for a private-equity deal-tracking platform.
Given source text (SEC filing, earnings transcript, or news), determine whether it indicates a company being sold, divested, carved out, or subject to strategic alternatives — and at what stage of that process.

Stages:
- in_market: an active sale process is underway (advisers engaged, bids solicited).
- monitor_for_exit: a sale is anticipated or being evaluated but no formal process yet.
- on_hold: a process was paused.
- pulled: the owner decided to retain the asset / cancelled the process.

deal_type: "carveout" if a corporate parent is divesting a unit; "private_asset" if a PE sponsor is exiting a portfolio company.
confidence: "high" if a primary source (filing/transcript) explicitly confirms; "medium" if reported by reputable press; "low"/"needs_review" if ambiguous, single-sourced, or contradictory.

Also extract any financials explicitly stated in the source (revenue, EBITDA, EBITDA margin, deal size). Leave a field empty if it is not stated — never guess.

Call record_signal exactly once. If no relevant signal is present, set found=false.

${UNTRUSTED_GUARD}`;

const TOOL: Anthropic.Tool = {
  name: "record_signal",
  description: "Record the extracted M&A signal as structured data.",
  input_schema: {
    type: "object",
    properties: {
      found: {
        type: "boolean",
        description: "true if a relevant divestiture/sale signal is present",
      },
      company_name: {
        type: "string",
        description: "the asset/company being sold or divested",
      },
      parent_company: {
        type: "string",
        description: "divesting corporate parent (carveouts)",
      },
      sponsor_firm: {
        type: "string",
        description: "PE sponsor exiting (private assets)",
      },
      sector: {
        type: "string",
        enum: [
          "chemicals",
          "industrials",
          "agriculture",
          "specialty_materials",
          "energy_fuels",
          "pharma_inputs",
          "consumer_coatings",
          "aerospace_defense",
          "capital_goods",
          "automotive",
          "transportation",
          "basic_materials",
        ],
        description: "best-fit sector for the asset",
      },
      deal_type: { type: "string", enum: ["carveout", "private_asset"] },
      stage: {
        type: "string",
        enum: ["in_market", "monitor_for_exit", "on_hold", "pulled"],
      },
      confidence: { type: "string", enum: ["high", "medium", "low", "needs_review"] },
      key_quote: {
        type: "string",
        description: "the exact sentence that triggered the signal",
      },
      reasoning: { type: "string", description: "one-sentence justification" },
      revenue: {
        type: "string",
        description: 'annual revenue if explicitly stated, e.g. "$1.2B"',
      },
      ebitda: {
        type: "string",
        description: 'EBITDA if explicitly stated, e.g. "$280M"',
      },
      margin: { type: "string", description: 'EBITDA margin if stated, e.g. "23%"' },
      deal_size: {
        type: "string",
        description: 'reported or expected deal value, e.g. "$600M"',
      },
    },
    required: ["found"],
  },
};

// Rough Sonnet pricing (USD per million tokens). Override per-deployment.
const COST_IN_PER_M = Number(process.env.LLM_COST_IN_PER_M ?? 3);
const COST_OUT_PER_M = Number(process.env.LLM_COST_OUT_PER_M ?? 15);

async function logUsage(usage: Anthropic.Usage, sourceType: SourceType): Promise<void> {
  if (!hasSupabaseEnv()) return;
  const costUsd = +(
    (usage.input_tokens / 1_000_000) * COST_IN_PER_M +
    (usage.output_tokens / 1_000_000) * COST_OUT_PER_M
  ).toFixed(6);
  try {
    await createServiceClient().from("llm_usage").insert({
      source_type: sourceType,
      model: MODEL,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: costUsd,
    });
  } catch {
    // logging is best-effort
  }
}

export async function extractSignal(
  input: ExtractInput
): Promise<ExtractedSignal | null> {
  if (!hasAnthropicEnv()) return null;
  if (!input.rawText?.trim()) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  try {
    await waitForLlmSlot(); // Redis rate limit (no-op without Upstash env)
    const res = await withSpan("llm.extract", "gen_ai.invoke_agent", () =>
      withRetry(() =>
        client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          tools: [TOOL],
          tool_choice: { type: "tool", name: "record_signal" },
          messages: [
            {
              role: "user",
              content: `Source type: ${input.sourceType}\n\n${wrapUntrusted(input.rawText)}`,
            },
          ],
        })
      )
    );

    void logUsage(res.usage, input.sourceType);

    const toolUse = res.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    return toolUse.input as ExtractedSignal;
  } catch {
    return null;
  }
}
