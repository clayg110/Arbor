"use client";

import { useState, useEffect } from "react";
import { api, BackendOff } from "@/lib/api-client";
import {
  PROCESS_STAGES,
  PROCESS_STAGE_LABELS,
  PROCESS_STAGE_SHORT,
  PROCESS_STAGE_COLORS,
  isTerminalStage,
  type OurProcessStage,
  type ProcessHistoryEntry,
  type ProcessKeyDates,
} from "@/lib/process-stage";

interface Props {
  companyId: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ProcessStageSection({ companyId }: Props) {
  const [stage, setStage] = useState<OurProcessStage | null>(null);
  const [keyDates, setKeyDates] = useState<ProcessKeyDates>({});
  const [history, setHistory] = useState<ProcessHistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingDate, setEditingDate] = useState<OurProcessStage | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [showNotesFor, setShowNotesFor] = useState<OurProcessStage | null>(null);
  const [backendOff, setBackendOff] = useState(false);

  useEffect(() => {
    api
      .getProcessStage(companyId)
      .then((res) => {
        setStage(res.stage);
        setKeyDates(res.keyDates);
        setHistory(res.history);
      })
      .catch((e) => {
        if (e instanceof BackendOff) setBackendOff(true);
      });
  }, [companyId]);

  async function handleSetStage(s: OurProcessStage) {
    if (saving) return;
    const newStage = stage === s ? null : s;

    // Non-terminal stage selection prompts for an optional note first. Always
    // (re)open the prompt for the clicked stage and reset any note left over
    // from a different stage, so notes never attach to the wrong stage.
    if (newStage && !isTerminalStage(s) && showNotesFor !== s) {
      setNotesInput("");
      setShowNotesFor(s);
      return;
    }

    // Only carry the typed note when confirming the stage it was written for.
    const noteToSave = showNotesFor === s ? notesInput : "";

    setSaving(true);
    const prev = stage;
    setStage(newStage);
    setShowNotesFor(null);

    try {
      await api.setProcessStage(companyId, {
        stage: newStage,
        notes: noteToSave || undefined,
      });
      const res = await api.getProcessStage(companyId);
      setHistory(res.history);
      setNotesInput("");
    } catch {
      setStage(prev);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDate(s: OurProcessStage) {
    const trimmed = dateInput.trim();
    setEditingDate(null);
    const prev = keyDates;
    const next = trimmed ? { ...keyDates, [s]: trimmed } : { ...keyDates };
    if (!trimmed) delete next[s];
    setKeyDates(next);
    try {
      const res = await api.updateProcessKeyDate(companyId, {
        stage: s,
        date: trimmed || null,
      });
      setKeyDates(res.keyDates);
    } catch {
      setKeyDates(prev);
    }
  }

  if (backendOff) return null;

  const currentIdx = stage ? PROCESS_STAGES.indexOf(stage) : -1;
  const activeStages = PROCESS_STAGES.filter((s) => !isTerminalStage(s));
  const terminalStages = PROCESS_STAGES.filter(isTerminalStage);

  return (
    <div className="space-y-4">
      {/* Pipeline stepper */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1">
          {activeStages.map((s) => {
            const idx = PROCESS_STAGES.indexOf(s);
            const isActive = stage === s;
            const isPast = currentIdx > idx && !isTerminalStage(stage ?? "watching");
            const c = PROCESS_STAGE_COLORS[s];
            const kd = keyDates[s];

            return (
              <div key={s} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => handleSetStage(s)}
                  disabled={saving}
                  title={PROCESS_STAGE_LABELS[s]}
                  style={
                    isActive
                      ? { backgroundColor: c.bg, color: c.text, borderColor: c.border }
                      : isPast
                        ? {
                            backgroundColor: "#f0fdf4",
                            color: "#157A5A",
                            borderColor: "#bbf7d0",
                          }
                        : {}
                  }
                  className={[
                    "rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                    isActive
                      ? "border-current shadow-sm"
                      : isPast
                        ? "border-current"
                        : "border-[#e5e5e2] bg-white text-[#5f5e57] hover:border-[#c5c4c0] hover:bg-[#fafaf8]",
                    saving ? "opacity-60" : "cursor-pointer",
                  ].join(" ")}
                >
                  {PROCESS_STAGE_SHORT[s]}
                </button>
                {/* key date */}
                {editingDate === s ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Jun 25"
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      onBlur={() => handleSaveDate(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveDate(s);
                        if (e.key === "Escape") setEditingDate(null);
                      }}
                      className="w-16 rounded border border-[#e5e5e2] px-1 py-0.5 text-[10px] text-[#1a1917] outline-none focus:border-[#185FA5]"
                    />
                  </div>
                ) : kd ? (
                  <button
                    onClick={() => {
                      setDateInput(kd);
                      setEditingDate(s);
                    }}
                    className="text-[10px] text-[#185FA5] hover:underline"
                    title="Edit key date"
                  >
                    {kd}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setDateInput("");
                      setEditingDate(s);
                    }}
                    className="text-[10px] text-[#9e9d9a] hover:text-[#5f5e57]"
                    title="Add key date"
                  >
                    +date
                  </button>
                )}
              </div>
            );
          })}

          <div className="mx-1 self-start border-l border-[#e5e5e2]" />

          {/* terminal stages */}
          {terminalStages.map((s) => {
            const isActive = stage === s;
            const c = PROCESS_STAGE_COLORS[s];
            return (
              <button
                key={s}
                onClick={() => handleSetStage(s)}
                disabled={saving}
                title={PROCESS_STAGE_LABELS[s]}
                style={
                  isActive
                    ? { backgroundColor: c.bg, color: c.text, borderColor: c.border }
                    : {}
                }
                className={[
                  "self-start rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                  isActive
                    ? "border-current shadow-sm"
                    : "border-[#e5e5e2] bg-white text-[#5f5e57] hover:border-[#c5c4c0] hover:bg-[#fafaf8]",
                  saving ? "opacity-60" : "cursor-pointer",
                ].join(" ")}
              >
                {PROCESS_STAGE_SHORT[s]}
              </button>
            );
          })}

          {stage && (
            <button
              onClick={() => handleSetStage(stage)}
              disabled={saving}
              className="self-start text-[10px] text-[#9e9d9a] hover:text-[#C0322F]"
              title="Clear process stage"
            >
              ✕ clear
            </button>
          )}
        </div>
      </div>

      {/* notes input for pending stage selection */}
      {showNotesFor && (
        <div className="flex items-center gap-2 rounded border border-[#e5e5e2] bg-[#fafaf8] px-3 py-2">
          <span className="text-[12px] text-[#5f5e57]">
            Move to <strong>{PROCESS_STAGE_LABELS[showNotesFor]}</strong>
          </span>
          <input
            autoFocus
            type="text"
            placeholder="Notes (optional)"
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSetStage(showNotesFor);
              if (e.key === "Escape") setShowNotesFor(null);
            }}
            className="flex-1 rounded border border-[#e5e5e2] px-2 py-1 text-[12px] outline-none focus:border-[#185FA5]"
          />
          <button
            onClick={() => handleSetStage(showNotesFor)}
            className="rounded bg-[#185FA5] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#1450a0]"
          >
            Confirm
          </button>
          <button
            onClick={() => setShowNotesFor(null)}
            className="text-[12px] text-[#9e9d9a] hover:text-[#5f5e57]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* stage summary */}
      {stage && (
        <div
          className="flex items-center gap-2 rounded border px-3 py-2 text-[12px]"
          style={{
            backgroundColor: PROCESS_STAGE_COLORS[stage].bg,
            borderColor: PROCESS_STAGE_COLORS[stage].border,
            color: PROCESS_STAGE_COLORS[stage].text,
          }}
        >
          <span className="font-semibold">{PROCESS_STAGE_LABELS[stage]}</span>
          {keyDates[stage] && (
            <span className="text-[11px] opacity-80">· Due {keyDates[stage]}</span>
          )}
        </div>
      )}

      {/* history log */}
      {history.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#9e9d9a]">
            Process history
          </p>
          <div className="divide-y divide-[#f0f0ee]">
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-2 py-1.5">
                <div
                  className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: PROCESS_STAGE_COLORS[h.stage].bg,
                    color: PROCESS_STAGE_COLORS[h.stage].text,
                  }}
                >
                  {PROCESS_STAGE_SHORT[h.stage]}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-[#5f5e57]">
                    {h.authorName} · {formatDateTime(h.changedAt)}
                  </span>
                  {h.notes && (
                    <p className="mt-0.5 text-[11px] text-[#1a1917]">{h.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
