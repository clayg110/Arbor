"use client";

import { useState } from "react";
import { api, BackendOff } from "@/lib/api-client";

type Phase = "idle" | "loading" | "done" | "dormant" | "offline" | "error";
interface Section {
  title: string;
  body: string;
}

// Local markdown builder — kept here (not imported from lib/ic-memo) so the
// Anthropic SDK that module pulls in never reaches the client bundle.
function toMarkdown(
  companyName: string,
  sections: Section[],
  generatedAt: string
): string {
  const head = `# IC Memo — ${companyName}\n\n_Generated ${generatedAt.slice(0, 10)} · AI-drafted, verify before acting._\n`;
  const body = sections
    .filter((s) => s.body)
    .map((s) => `## ${s.title}\n\n${s.body}`)
    .join("\n\n");
  return `${head}\n${body}\n`;
}

export function IcMemo({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sections, setSections] = useState<Section[]>([]);
  const [cached, setCached] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setPhase("loading");
    try {
      const r = await api.icMemo(companyId);
      if (!r.configured) {
        setPhase("dormant");
        return;
      }
      if (!r.sections) {
        setPhase("error");
        return;
      }
      setSections(r.sections);
      setCached(r.cached);
      setGeneratedAt(r.generatedAt ?? new Date().toISOString());
      setPhase("done");
    } catch (e) {
      setPhase(e instanceof BackendOff ? "offline" : "error");
    }
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(toMarkdown(companyName, sections, generatedAt));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  function downloadMarkdown() {
    const md = toMarkdown(companyName, sections, generatedAt);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ic-memo-${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const populated = sections.filter((s) => s.body);

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-muted">
          A structured IC memo — sections pull signals, process status, and comps.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={phase === "loading"}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          {phase === "loading"
            ? "Generating…"
            : populated.length
              ? "Regenerate IC memo"
              : "Generate IC memo"}
        </button>
      </div>

      {phase === "done" && populated.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={copyMarkdown}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[#185FA5]"
              style={{ border: "0.5px solid var(--border)" }}
            >
              {copied ? "Copied ✓" : "Copy as Markdown"}
            </button>
            <button
              type="button"
              onClick={downloadMarkdown}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[#185FA5]"
              style={{ border: "0.5px solid var(--border)" }}
            >
              Download
            </button>
          </div>

          <div
            className="rounded-lg bg-surface"
            style={{ border: "0.5px solid var(--border)" }}
          >
            {populated.map((s, i) => (
              <section
                key={s.title}
                className={i > 0 ? "border-t p-3" : "p-3"}
                style={i > 0 ? { borderColor: "var(--border)" } : undefined}
              >
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#185FA5]">
                  {s.title}
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
                  {s.body}
                </p>
              </section>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-subtle">
            {cached ? "Cached — regenerate to refresh." : "Freshly generated."}{" "}
            AI-written; verify before acting.
          </p>
        </div>
      )}

      <div className="mt-2">
        {phase === "offline" && (
          <p className="text-[12px] text-muted">
            IC memo is available when the backend is connected.
          </p>
        )}
        {phase === "dormant" && (
          <p className="text-[12px] text-muted">
            Set <code className="text-ink">ANTHROPIC_API_KEY</code> to enable IC memos.
          </p>
        )}
        {phase === "error" && (
          <p className="text-[12px] text-[#791F1F]">Something went wrong. Try again.</p>
        )}
      </div>
    </div>
  );
}
