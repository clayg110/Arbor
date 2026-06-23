"use client";

import { useEffect, useRef, useState } from "react";
import { api, BackendOff } from "@/lib/api-client";
import type { DealTask, OutreachEntry } from "@/lib/deal-tasks";
import { sortTasks, isOverdue, formatDue, OUTREACH_TYPES } from "@/lib/deal-tasks";
import { stagesWithChecklist, suggestedTasks } from "@/lib/task-templates";
import { PROCESS_STAGE_LABELS, type OurProcessStage } from "@/lib/process-stage";
import { XIcon } from "@/components/ui/icons";

const CHECKLIST_STAGES = stagesWithChecklist();

interface OrgMember {
  id: string;
  name: string;
  handle: string;
}

// ── Owner assignment ──────────────────────────────────────────────────────────

interface OwnerProps {
  companyId: string;
  currentUserId: string | null | undefined;
  initialOwner?: { id: string; email: string } | null;
}

export function DealOwnerSection({ companyId, currentUserId, initialOwner }: OwnerProps) {
  const [owner, setOwner] = useState(initialOwner ?? null);
  const [busy, setBusy] = useState(false);

  async function assignSelf() {
    if (!currentUserId) return;
    setBusy(true);
    try {
      await api.assignOwner(companyId, currentUserId);
      setOwner({ id: currentUserId, email: "You" });
    } catch {
      // best-effort
    } finally {
      setBusy(false);
    }
  }

  async function unassign() {
    setBusy(true);
    try {
      await api.assignOwner(companyId, null);
      setOwner(null);
    } catch {
      // best-effort
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {owner ? (
        <>
          <span className="rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[11px] font-medium text-[#0C447C]">
            {owner.id === currentUserId ? "You" : owner.email}
          </span>
          {owner.id === currentUserId && (
            <button
              type="button"
              onClick={unassign}
              disabled={busy}
              className="text-[11px] text-muted hover:text-[#791F1F] disabled:opacity-50"
            >
              Unassign
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={assignSelf}
          disabled={busy || !currentUserId}
          className="rounded-md px-2.5 py-1 text-[12px] font-medium text-[#185FA5] hover:bg-[#E6F1FB] disabled:opacity-50"
          style={{ border: "0.5px solid var(--border)" }}
        >
          {busy ? "Assigning…" : "Assign to me"}
        </button>
      )}
    </div>
  );
}

// ── Deal tasks ────────────────────────────────────────────────────────────────

export function DealTasksSection({
  companyId,
  currentUserId,
}: {
  companyId: string;
  currentUserId: string | null | undefined;
}) {
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [playbookStage, setPlaybookStage] = useState<OurProcessStage>(
    CHECKLIST_STAGES[0]!
  );
  const [addingPlaybook, setAddingPlaybook] = useState(false);

  useEffect(() => {
    api
      .listTasks(companyId)
      .then((r) => {
        setTasks(r.tasks);
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof BackendOff) setOffline(true);
        setLoaded(true);
      });
  }, [companyId]);

  async function addTask() {
    if (!title.trim()) return;
    setAdding(true);
    try {
      const { task } = await api.createTask(companyId, {
        title: title.trim(),
        dueAt: dueAt || null,
      });
      setTasks((prev) => sortTasks([...prev, task]));
      setTitle("");
      setDueAt("");
      setShowAdd(false);
    } catch {
      // best-effort
    } finally {
      setAdding(false);
    }
  }

  async function toggleComplete(task: DealTask) {
    const next = !task.completedAt;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completedAt: next ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      await api.completeTask(companyId, task.id, next);
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completedAt: task.completedAt } : t))
      );
    }
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    api.deleteTask(companyId, id).catch(() => {
      api
        .listTasks(companyId)
        .then((r) => setTasks(r.tasks))
        .catch(() => {});
    });
  }

  // Add the selected stage's playbook as dated tasks, skipping any already there.
  async function addPlaybook() {
    setAddingPlaybook(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const items = suggestedTasks(
        playbookStage,
        today,
        tasks.map((t) => t.title)
      );
      const created: DealTask[] = [];
      for (const it of items) {
        const { task } = await api.createTask(companyId, {
          title: it.title,
          dueAt: it.dueAt,
        });
        created.push(task);
      }
      if (created.length) setTasks((prev) => sortTasks([...prev, ...created]));
    } catch {
      // best-effort
    } finally {
      setAddingPlaybook(false);
    }
  }

  if (!loaded) return null;
  if (offline)
    return <p className="text-[12px] text-muted">Tasks require a connected backend.</p>;

  const sorted = sortTasks(tasks);
  const incomplete = sorted.filter((t) => !t.completedAt);
  const done = sorted.filter((t) => !!t.completedAt);

  return (
    <div>
      <ul className="space-y-1">
        {incomplete.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            canDelete={!currentUserId || t.userId === currentUserId}
            onToggle={() => toggleComplete(t)}
            onDelete={() => deleteTask(t.id)}
          />
        ))}
        {done.slice(0, 3).map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            canDelete={!currentUserId || t.userId === currentUserId}
            onToggle={() => toggleComplete(t)}
            onDelete={() => deleteTask(t.id)}
          />
        ))}
      </ul>

      {!showAdd ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-[12px] text-[#185FA5] hover:underline"
          >
            + Add task
          </button>
          <span className="flex items-center gap-1.5">
            <select
              value={playbookStage}
              onChange={(e) => setPlaybookStage(e.target.value as OurProcessStage)}
              aria-label="Playbook stage"
              className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-muted focus:outline-none focus-ring"
              style={{ border: "0.5px solid var(--border)" }}
            >
              {CHECKLIST_STAGES.map((s) => (
                <option key={s} value={s}>
                  {PROCESS_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addPlaybook}
              disabled={addingPlaybook}
              className="text-[12px] text-[#185FA5] hover:underline disabled:opacity-50"
            >
              {addingPlaybook ? "Adding…" : "+ Add playbook"}
            </button>
          </span>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Task title…"
            maxLength={500}
            className="w-full rounded-md bg-surface px-3 py-1.5 text-[12px] text-ink focus:outline-none focus-ring"
            style={{ border: "0.5px solid var(--border)" }}
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded-md bg-surface px-2 py-1 text-[11px] text-muted focus:outline-none focus-ring"
              style={{ border: "0.5px solid var(--border)" }}
            />
            <button
              type="button"
              onClick={addTask}
              disabled={!title.trim() || adding}
              className="rounded-md px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#185FA5" }}
            >
              {adding ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-[12px] text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  canDelete,
  onToggle,
  onDelete,
}: {
  task: DealTask;
  canDelete: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const done = !!task.completedAt;
  const overdue = !done && isOverdue(task);
  const dueLabel = formatDue(task.dueAt);

  return (
    <li className="group flex items-start gap-2">
      <input
        type="checkbox"
        checked={done}
        onChange={onToggle}
        aria-label={`${done ? "Reopen" : "Complete"}: ${task.title}`}
        className="mt-0.5 shrink-0 cursor-pointer accent-[#185FA5]"
      />
      <div className="min-w-0 flex-1">
        <span className={`text-[12px] ${done ? "text-muted line-through" : "text-ink"}`}>
          {task.title}
        </span>
        {dueLabel && (
          <span
            className={`ml-2 text-[10px] font-medium ${
              overdue ? "text-[#791F1F]" : "text-muted"
            }`}
          >
            {dueLabel}
          </span>
        )}
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete task: ${task.title}`}
          className="shrink-0 text-subtle opacity-0 hover:text-[#791F1F] group-hover:opacity-100"
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}

// ── Outreach log ─────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<OutreachEntry["type"], string> = {
  call: "#1A4F2A",
  email: "#185FA5",
  meeting: "#633806",
  other: "#555",
};

export function OutreachLogSection({
  companyId,
  currentUserId,
}: {
  companyId: string;
  currentUserId: string | null | undefined;
}) {
  const [entries, setEntries] = useState<OutreachEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<OutreachEntry["type"]>("call");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  // @mention autocomplete
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  useEffect(() => {
    api
      .listOutreach(companyId)
      .then((r) => {
        setEntries(r.entries);
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof BackendOff) setOffline(true);
        setLoaded(true);
      });
  }, [companyId]);

  useEffect(() => {
    api
      .getOrgMembers()
      .then((r) => setMembers(r.members))
      .catch(() => {});
  }, []);

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setNote(e.target.value);
    const cursor = e.target.selectionStart ?? e.target.value.length;
    const before = e.target.value.slice(0, cursor);
    const m = before.match(/@([A-Za-z0-9._-]*)$/);
    if (m) {
      setMentionQuery(m[1]!.toLowerCase());
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  }

  const mentionSuggestions =
    mentionQuery !== null
      ? members.filter((m) => m.handle.startsWith(mentionQuery)).slice(0, 8)
      : [];

  function insertMention(member: OrgMember) {
    const ta = noteRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? note.length;
    const before = note.slice(0, cursor);
    const after = note.slice(cursor);
    const match = before.match(/@([A-Za-z0-9._-]*)$/);
    if (!match) return;
    const start = cursor - match[0].length;
    const inserted = `@${member.handle} `;
    setNote(note.slice(0, start) + inserted + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (!noteRef.current) return;
      const pos = start + inserted.length;
      noteRef.current.selectionStart = pos;
      noteRef.current.selectionEnd = pos;
      noteRef.current.focus();
    });
  }

  function handleNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIdx((i) => (i + 1) % mentionSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIdx(
        (i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const sel = mentionSuggestions[mentionIdx];
      if (sel) insertMention(sel);
    } else if (e.key === "Escape") {
      setMentionQuery(null);
    }
  }

  async function log() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const { entry } = await api.logOutreach(companyId, { type, note: note.trim() });
      setEntries((prev) => [entry, ...prev]);
      setNote("");
      setShowForm(false);
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    api.deleteOutreach(companyId, id).catch(() => {
      api
        .listOutreach(companyId)
        .then((r) => setEntries(r.entries))
        .catch(() => {});
    });
  }

  if (!loaded) return null;
  if (offline)
    return (
      <p className="text-[12px] text-muted">Outreach log requires a connected backend.</p>
    );

  return (
    <div>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="group flex gap-2">
            <span
              className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white"
              style={{ backgroundColor: TYPE_COLOR[e.type] }}
            >
              {e.type}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink">{renderMentions(e.note)}</p>
              <p className="text-[10px] text-muted">
                {e.authorName} ·{" "}
                {new Date(e.contactedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            {(!currentUserId || e.userId === currentUserId) && (
              <button
                type="button"
                onClick={() => remove(e.id)}
                aria-label="Delete entry"
                className="shrink-0 text-subtle opacity-0 hover:text-[#791F1F] group-hover:opacity-100"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </li>
        ))}
        {entries.length === 0 && !showForm && (
          <li className="text-[12px] text-muted">No outreach logged yet.</li>
        )}
      </ul>

      {!showForm && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-[12px] text-[#185FA5] hover:underline"
          >
            + Log activity
          </button>
          <button
            type="button"
            onClick={async () => {
              setDrafting(true);
              setDraft(null);
              try {
                const r = await api.draftOutreachEmail(companyId);
                if (!r.configured) setDraft("Set ANTHROPIC_API_KEY to enable AI drafts.");
                else setDraft(r.draft ?? "No draft generated.");
              } catch {
                setDraft("Failed to generate draft.");
              } finally {
                setDrafting(false);
              }
            }}
            disabled={drafting}
            className="text-[12px] text-muted hover:text-ink disabled:opacity-50"
          >
            {drafting ? "Drafting…" : "✦ Draft email"}
          </button>
        </div>
      )}

      {draft && !showForm && (
        <div
          className="mt-2 rounded-lg p-3"
          style={{ background: "var(--bg)", border: "0.5px solid var(--border)" }}
        >
          <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted">
            AI-drafted outreach
          </p>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
            {draft}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(draft).catch(() => {});
              }}
              className="text-[11px] text-[#185FA5] hover:underline"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-[11px] text-muted hover:text-ink"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-subtle">
            AI-written — review before sending.
          </p>
        </div>
      )}

      {showForm && (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as OutreachEntry["type"])}
              aria-label="Activity type"
              className="rounded-md bg-surface px-2 py-1.5 text-[12px] text-ink focus:outline-none focus-ring"
              style={{ border: "0.5px solid var(--border)" }}
            >
              {OUTREACH_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <textarea
              ref={noteRef}
              autoFocus
              value={note}
              onChange={handleNoteChange}
              onKeyDown={handleNoteKeyDown}
              placeholder="Notes… Use @name to mention a teammate."
              rows={3}
              maxLength={2000}
              className="w-full rounded-md bg-surface px-3 py-2 text-[12px] text-ink focus:outline-none focus-ring"
              style={{ border: "0.5px solid var(--border)" }}
            />
            {mentionSuggestions.length > 0 && (
              <ul
                role="listbox"
                aria-label="Mention suggestions"
                className="absolute left-0 z-10 mt-0.5 max-h-40 w-full overflow-y-auto rounded-md bg-surface shadow-md"
                style={{ border: "0.5px solid var(--border)" }}
              >
                {mentionSuggestions.map((m, i) => (
                  <li key={m.id} role="option" aria-selected={i === mentionIdx}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // keep textarea focused
                        insertMention(m);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-[12px] ${
                        i === mentionIdx
                          ? "bg-[#E6F1FB] text-[#185FA5]"
                          : "text-ink hover:bg-[#E6F1FB]"
                      }`}
                    >
                      <span className="font-medium">@{m.handle}</span>
                      <span className="ml-2 text-muted">{m.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={log}
              disabled={!note.trim() || saving}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#185FA5" }}
            >
              {saving ? "Saving…" : "Log"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-[12px] text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Highlights @mention tokens in note text.
function renderMentions(content: string): React.ReactNode {
  const parts = content.split(/(@[A-Za-z][A-Za-z0-9._-]{0,49})/g);
  return parts.map((part, i) =>
    /^@/.test(part) ? (
      <span key={i} className="font-medium text-[#185FA5]">
        {part}
      </span>
    ) : (
      part
    )
  );
}
