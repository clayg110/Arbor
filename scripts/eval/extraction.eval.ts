// Live LLM extraction eval. Runs the real extractor over the golden set
// (tests/fixtures/extraction-golden.ts), then asserts grounding (lib/llm-eval)
// and the labeled found/stage expectations — including a prompt-injection case
// the guard (lib/llm-safety) must keep the model from obeying.
//
// Run:  pnpm eval:extraction
// Needs ANTHROPIC_API_KEY (loaded from .env.local). With no key it SKIPS and
// exits 0, so it's safe to wire into CI behind a secret without breaking forks.

import { readFileSync } from "node:fs";
import { extractSignal } from "../../lib/extract-signal";
import { checkGrounding, summarizeGrounding } from "../../lib/llm-eval";
import { GOLDEN } from "../../tests/fixtures/extraction-golden";

// Load .env.local into process.env (extract-signal reads the key lazily).
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
} catch {
  // no .env.local — rely on ambient env
}

const GROUNDING_FLOOR = 0.9;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("eval:extraction — skipped (no ANTHROPIC_API_KEY).");
    return;
  }

  const results: ReturnType<typeof checkGrounding>[] = [];
  let mismatches = 0;

  for (const c of GOLDEN) {
    const out = await extractSignal({ rawText: c.sourceText, sourceType: c.sourceType });
    if (!out) {
      console.log(`✗ ${c.name} — extractor returned null`);
      mismatches++;
      continue;
    }
    const g = checkGrounding(out, c.sourceText);
    results.push(g);

    const foundOk = out.found === c.expectFound;
    const stageOk = !c.expectStage || out.stage === c.expectStage;
    const dealOk = !c.expectDealType || out.deal_type === c.expectDealType;
    const pass = g.grounded && foundOk && stageOk && dealOk;
    if (!pass) mismatches++;

    const detail = [
      `found=${out.found}`,
      c.expectStage ? `stage=${out.stage ?? "-"}` : null,
      c.expectDealType ? `deal=${out.deal_type ?? "-"}` : null,
      `grounded=${g.grounded}`,
      g.violations.length ? `viol=${JSON.stringify(g.violations)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    console.log(`${pass ? "✓" : "✗"} ${c.name} — ${detail}`);
  }

  const s = summarizeGrounding(results);
  console.log(
    `\nGrounding: ${(s.passRate * 100).toFixed(0)}% (${s.grounded}/${s.total}); ` +
      `expectation mismatches: ${mismatches}`
  );

  if (s.passRate < GROUNDING_FLOOR || mismatches > 0) {
    console.error("EVAL FAILED");
    process.exit(1);
  }
  console.log("EVAL PASSED");
}

main();
