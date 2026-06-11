// Auto-draft an outreach email to a PE sponsor or corporate parent using Claude.
// Dormant without ANTHROPIC_API_KEY (returns null, UI shows configure state).

import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/retry";
import { withSpan } from "@/lib/trace";
import { waitForLlmSlot } from "@/lib/redis/ratelimit";
import { hasAnthropicEnv } from "@/lib/extract-signal";
import { buildContext, truncate } from "@/lib/memo";
import type { Company, Signal } from "@/lib/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const OUTREACH_SYSTEM = `You are a private-equity associate drafting a brief, professional outreach email to a corporate parent (for a carveout) or PE sponsor (for a sponsor-backed exit).
Requirements:
- 2–3 short paragraphs, under 150 words total
- Express genuine interest without disclosing proprietary signal sources
- Mention the company name and sector naturally
- Ask for a brief introductory call
- Close with: "Best, [Deal Team]"
Write ONLY the email body (no subject line). Plain text, no markdown.`;

// Pure — builds the user prompt. Unit-testable without hitting the API.
export function buildOutreachDraftPrompt(company: Company, signals: Signal[]): string {
  const context = buildContext(company, signals);
  const role =
    company.dealType === "carveout"
      ? `corporate parent (${company.parentCompany ?? "undisclosed"})`
      : `PE sponsor (${company.sponsorFirm ?? "undisclosed"})`;
  return `${context}\n\nDraft a professional outreach email to the ${role} expressing our interest in the potential transaction.`;
}

export async function draftOutreachEmail(
  company: Company,
  signals: Signal[]
): Promise<string | null> {
  if (!hasAnthropicEnv()) return null;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  try {
    await waitForLlmSlot();
    const userText = truncate(buildOutreachDraftPrompt(company, signals), 3000);
    const res = await withSpan("llm.outreach-draft", "gen_ai.invoke_agent", () =>
      withRetry(() =>
        client.messages.create({
          model: MODEL,
          max_tokens: 400,
          system: [
            { type: "text", text: OUTREACH_SYSTEM, cache_control: { type: "ephemeral" } },
          ],
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
