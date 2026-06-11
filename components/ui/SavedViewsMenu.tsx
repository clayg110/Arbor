"use client";

import { useEffect, useRef, useState } from "react";
import { api, BackendOff, type SavedView, type SavedViewFilters } from "@/lib/api-client";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { XIcon } from "@/components/ui/icons";

interface Props {
  currentFilters: SavedViewFilters;
  onLoad: (filters: SavedViewFilters) => void;
}

export function SavedViewsMenu({ currentFilters, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .listSavedViews()
      .then((r) => {
        setViews(r.views);
        setLoaded(true);
      })
      .catch((e) => {
        if (!(e instanceof BackendOff)) return;
        setLoaded(true);
      });
  }, []);

  function refresh() {
    api
      .listSavedViews()
      .then((r) => setViews(r.views))
      .catch(() => {});
  }

  function deleteView(id: string) {
    setViews((prev) => prev.filter((v) => v.id !== id));
    api.deleteSavedView(id).catch(() => refresh());
  }

  if (!loaded) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
        style={{ border: "0.5px solid var(--border)" }}
      >
        Views {views.length > 0 && `(${views.length})`}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[220px] rounded-lg bg-surface p-2 shadow-md"
          style={{ border: "0.5px solid var(--border)" }}
        >
          {views.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-muted">No saved views yet.</p>
          ) : (
            <ul className="mb-1">
              {views.map((v) => (
                <li key={v.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onLoad(v.filters);
                      setOpen(false);
                    }}
                    className="flex-1 truncate rounded px-2 py-1.5 text-left text-[12px] text-ink hover:bg-[#F5F4EF]"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete view ${v.name}`}
                    onClick={() => deleteView(v.id)}
                    className="shrink-0 rounded p-1 text-subtle hover:text-[#791F1F]"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div
            style={{
              borderTop: "0.5px solid var(--border)",
              marginTop: 4,
              paddingTop: 4,
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setShowSave(true);
                setOpen(false);
              }}
              className="w-full rounded px-2 py-1.5 text-left text-[12px] font-medium text-[#185FA5] hover:bg-[#E6F1FB]"
            >
              + Save current filters…
            </button>
          </div>
        </div>
      )}

      {showSave && (
        <SaveViewModal
          filters={currentFilters}
          onSaved={(v) => {
            setViews((prev) => [v, ...prev]);
            setShowSave(false);
          }}
          onClose={() => setShowSave(false)}
        />
      )}
    </div>
  );
}

function SaveViewModal({
  filters,
  onSaved,
  onClose,
}: {
  filters: SavedViewFilters;
  onSaved: (v: SavedView) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    setErr(null);
    try {
      const { view } = await api.createSavedView({ name: n, filters });
      onSaved(view);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Save current filters as a view"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-surface p-5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-ink">Save view</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-subtle hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[12px] text-muted">
          Save the current filters as a named view for quick access.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="View name…"
          aria-label="View name"
          maxLength={100}
          className="mb-3 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
          style={{ border: "0.5px solid var(--border)" }}
        />
        {err && <p className="mb-2 text-[12px] text-[#791F1F]">{err}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
            style={{ border: "0.5px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!name.trim() || saving}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: "#185FA5" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
