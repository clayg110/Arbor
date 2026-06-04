"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { api, BackendOff } from "@/lib/api-client";
import { PencilIcon, TrashIcon } from "./icons";
import type { Note } from "@/lib/types";

export function AnalystNoteEditor({
  initialNotes,
  companyId,
  currentUserId,
}: {
  initialNotes: Note[];
  companyId?: string;
  currentUserId?: string | null;
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const isLocal = (id: string) => id.startsWith("local-");
  const canManage = (n: Note) =>
    isLocal(n.id) || (!!currentUserId && n.userId === currentUserId);

  function add() {
    const content = draft.trim();
    if (!content) return;
    const cid = companyId ?? initialNotes[0]?.companyId ?? "";
    const tempId = `local-${Date.now()}`;
    setNotes((prev) => [
      {
        id: tempId,
        companyId: cid,
        userId: currentUserId ?? null,
        author: "You",
        initials: "YO",
        content,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setDraft("");

    if (!cid) return; // pure mock → optimistic only
    api
      .addNote(cid, content)
      .then((res) => {
        const note = (res as { note?: Note }).note;
        if (note) setNotes((prev) => prev.map((n) => (n.id === tempId ? note : n)));
      })
      .catch((e) => {
        if (!(e instanceof BackendOff)) {
          setNotes((prev) => prev.filter((n) => n.id !== tempId));
        }
      });
  }

  function startEdit(n: Note) {
    setEditingId(n.id);
    setEditDraft(n.content);
  }

  function saveEdit(n: Note) {
    const content = editDraft.trim();
    if (!content) return;
    const prevContent = n.content;
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, content } : x)));
    setEditingId(null);

    if (isLocal(n.id)) return; // not yet persisted
    api.editNote(n.id, content).catch((e) => {
      if (!(e instanceof BackendOff)) {
        setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, content: prevContent } : x)));
      }
    });
  }

  function remove(n: Note) {
    const snapshot = notes;
    setNotes((prev) => prev.filter((x) => x.id !== n.id));
    if (isLocal(n.id)) return;
    api.deleteNote(n.id).catch((e) => {
      if (!(e instanceof BackendOff)) setNotes(snapshot); // restore on real error
    });
  }

  return (
    <div>
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
                <span className="text-[12px] font-medium text-ink">{n.author}</span>
                <span className="text-[11px] font-normal text-subtle">{formatDate(n.createdAt)}</span>
                {canManage(n) && editingId !== n.id && (
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      aria-label="Edit note"
                      className="rounded p-1 text-subtle hover:text-ink"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      aria-label="Delete note"
                      className="rounded p-1 text-subtle hover:text-[#791F1F]"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>

              {editingId === n.id ? (
                <div className="mt-1">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-md bg-surface px-2 py-1.5 text-[13px] font-normal text-ink focus:outline-none"
                    style={{ border: "0.5px solid var(--border)" }}
                  />
                  <div className="mt-1.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-2.5 py-1 text-[12px] font-medium text-muted hover:text-ink"
                      style={{ border: "0.5px solid var(--border)" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(n)}
                      disabled={!editDraft.trim()}
                      className="rounded-md px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
                      style={{ backgroundColor: "#185FA5" }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-0.5 text-[13px] font-normal text-muted">{n.content}</p>
              )}
            </div>
          </li>
        ))}
        {notes.length === 0 && <li className="text-[13px] text-subtle">No notes yet.</li>}
      </ul>

      <div className="rounded-lg bg-surface p-3" style={{ border: "0.5px solid var(--border)" }}>
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
            onClick={add}
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
