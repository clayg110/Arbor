"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import type { Note } from "@/lib/types";

export function AnalystNoteEditor({
  initialNotes,
}: {
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");

  function submit() {
    const content = draft.trim();
    if (!content) return;
    setNotes([
      {
        id: `local-${Date.now()}`,
        companyId: initialNotes[0]?.companyId ?? "",
        author: "You",
        initials: "YO",
        content,
        createdAt: new Date().toISOString(),
      },
      ...notes,
    ]);
    setDraft("");
  }

  return (
    <div>
      {/* existing notes (above the editor) */}
      <ul className="mb-4 space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="flex gap-3">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1EFE8] text-[11px] font-medium text-[#444441]"
              aria-hidden
            >
              {n.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] font-medium text-ink">
                  {n.author}
                </span>
                <span className="text-[11px] font-normal text-subtle">
                  {formatDate(n.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] font-normal text-muted">
                {n.content}
              </p>
            </div>
          </li>
        ))}
        {notes.length === 0 && (
          <li className="text-[13px] text-subtle">No notes yet.</li>
        )}
      </ul>

      {/* editor */}
      <div
        className="rounded-lg bg-surface p-3"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full resize-none bg-transparent text-[13px] font-normal text-ink placeholder:text-subtle focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#185FA5" }}
          >
            Add note
          </button>
        </div>
      </div>
    </div>
  );
}
