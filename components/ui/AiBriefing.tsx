"use client";

import { useState } from "react";
import { api, BackendOff } from "@/lib/api-client";

type Phase = "idle" | "loading" | "done" | "dormant" | "offline" | "error";

function Dormant({ phase }: { phase: Phase }) {
  if (phase === "offline") {
    return (
      <p className="text-[12px] text-muted">
        AI briefing is available when the backend is connected.
      </p>
    );
  }
  if (phase === "dormant") {
    return (
      <p className="text-[12px] text-muted">
        Set <code className="text-ink">ANTHROPIC_API_KEY</code> to enable AI briefings.
      </p>
    );
  }
  if (phase === "error") {
    return <p className="text-[12px] text-[#791F1F]">Something went wrong. Try again.</p>;
  }
  return null;
}

// AI deal brief — generate (or fetch cached) a structured one-pager from the
// company's signal history. Dormant without a key / backend.
export function DealMemo({ companyId }: { companyId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [memo, setMemo] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  async function generate() {
    setPhase("loading");
    try {
      const r = await api.companyMemo(companyId);
      if (!r.configured) {
        setPhase("dormant");
        return;
      }
      if (!r.memo) {
        setPhase("error");
        return;
      }
      setMemo(r.memo);
      setCached(r.cached);
      setPhase("done");
    } catch (e) {
      setPhase(e instanceof BackendOff ? "offline" : "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-muted">
          A concise deal brief generated from the signals below.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={phase === "loading"}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          {phase === "loading" ? "Generating…" : memo ? "Regenerate" : "Generate brief"}
        </button>
      </div>

      {phase === "done" && memo && (
        <div
          className="mt-3 rounded-lg bg-surface p-3"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
            {memo}
          </p>
          <p className="mt-2 text-[10px] text-subtle">
            {cached ? "Cached — regenerate to refresh." : "Freshly generated."}{" "}
            AI-written; verify before acting.
          </p>
        </div>
      )}

      <div className="mt-2">
        <Dormant phase={phase} />
      </div>
    </div>
  );
}

// Grounded Q&A — answer a question using only the company's facts + signals.
export function CompanyQa({ companyId }: { companyId: string }) {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<
    {
      signalId: string;
      quote: string;
      sourceType: string;
      sourceName: string | null;
      ingestedAt: string;
    }[]
  >([]);
  const [showCitations, setShowCitations] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) return;
    setPhase("loading");
    setAnswer(null);
    setCitations([]);
    setShowCitations(false);
    try {
      const r = await api.askCompany(companyId, question.trim());
      if (!r.configured) {
        setPhase("dormant");
        return;
      }
      if (!r.answer) {
        setPhase("error");
        return;
      }
      setAnswer(r.answer);
      setCitations(r.citations ?? []);
      setPhase("done");
    } catch (err) {
      setPhase(err instanceof BackendOff ? "offline" : "error");
    }
  }

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
      <form onSubmit={ask} className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this company…"
          aria-label="Ask about this company"
          className="flex-1 rounded-md bg-surface px-3 py-2 text-[12px] text-ink focus:outline-none focus-ring"
          style={{ border: "0.5px solid var(--border)" }}
        />
        <button
          type="submit"
          disabled={phase === "loading" || question.trim().length < 3}
          className="shrink-0 rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          {phase === "loading" ? "…" : "Ask"}
        </button>
      </form>

      {phase === "done" && answer && (
        <div className="mt-3">
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
            {answer}
          </p>
          {citations.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowCitations((v) => !v)}
                className="text-[11px] text-[#185FA5] hover:underline"
              >
                {showCitations ? "Hide" : "Show"} {citations.length}{" "}
                {citations.length === 1 ? "citation" : "citations"}
              </button>
              {showCitations && (
                <ul className="mt-1.5 space-y-1.5">
                  {citations.map((c, i) => (
                    <li
                      key={c.signalId + i}
                      className="rounded-md px-2.5 py-2 text-[11px]"
                      style={{
                        background: "var(--bg)",
                        border: "0.5px solid var(--border)",
                      }}
                    >
                      <p className="text-ink">&ldquo;{c.quote}&rdquo;</p>
                      <p className="mt-0.5 text-muted">
                        {c.sourceName ?? c.sourceType} · {c.ingestedAt.slice(0, 10)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      <div className="mt-2">
        <Dormant phase={phase} />
      </div>
    </div>
  );
}
