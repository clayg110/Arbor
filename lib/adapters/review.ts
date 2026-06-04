// DB company + its signals → review-queue row shape.

import type { DbCompany, DbSignal } from "@/types/db";
import type { Company } from "@/lib/types";
import { toCompanyProfile } from "./company";

export interface ReviewRowData {
  company: Company;
  reason: string;
  conflictSummary: string;
}

export function toReviewRow(c: DbCompany, signals: DbSignal[]): ReviewRowData {
  const withConflict = signals.find((s) => s.llm_output?.conflict);
  const latest = signals[0];

  let reason = "Low-confidence entry";
  let conflictSummary = "Awaiting corroborating signals before raising confidence.";

  if (withConflict?.llm_output?.conflict) {
    const { signalA, signalB } = withConflict.llm_output.conflict;
    reason = "Conflicting signals";
    conflictSummary = `${signalA.source}: “${signalA.text}” vs ${signalB.source}: “${signalB.text}”`;
  } else if (latest?.llm_output?.reasoning) {
    conflictSummary = latest.llm_output.reasoning;
  } else if (latest?.raw_text) {
    conflictSummary = latest.raw_text;
  }

  return { company: toCompanyProfile(c), reason, conflictSummary };
}
