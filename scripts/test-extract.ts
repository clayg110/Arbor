// Standalone test for lib/extract-signal.ts (no pipelines, no Next).
// Run:  pnpm extract:test  ["optional source text..."]
// Needs ANTHROPIC_API_KEY (loaded from .env.local below).

import { readFileSync } from "node:fs";
import { extractSignal } from "../lib/extract-signal";

// Load .env.local into process.env (extract-signal reads the API key lazily).
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) {
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // no .env.local — rely on ambient env
}

const SAMPLE = `Dow Inc. announced today that it has engaged Goldman Sachs and Morgan Stanley
as financial advisors to assist in the evaluation of strategic alternatives for its
Polyurethanes segment, which may include a sale or spin-off of the business. A first
round of bids is expected by mid-year.`;

async function main() {
  const text = process.argv[2] || SAMPLE;
  console.log("Extracting…\n");
  const result = await extractSignal({ rawText: text, sourceType: "sec_filing" });
  if (result === null) {
    console.log("Result: null (no API key, or extraction failed).");
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main();
