"use client";

import { useEffect, useRef, useState } from "react";
import { api, BackendOff } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABELS,
  validateUpload,
  formatBytes,
  hasAnyFinancials,
  type DealDocument,
  type DocumentKind,
} from "@/lib/documents";

interface Props {
  companyId: string;
  fallback?: DealDocument[];
}

const STORAGE_BUCKET = "deal-documents";

export function DocumentsSection({ companyId, fallback = [] }: Props) {
  const [docs, setDocs] = useState<DealDocument[]>(fallback);
  const [backendOff, setBackendOff] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocumentKind>("cim");
  const [text, setText] = useState("");

  useEffect(() => {
    api
      .listDocuments(companyId)
      .then((r) => setDocs(r.documents))
      .catch((e) => {
        if (e instanceof BackendOff) setBackendOff(true);
      });
  }, [companyId]);

  function resetForm() {
    setKind("cim");
    setText("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    const check = validateUpload({
      name: file.name,
      sizeBytes: file.size,
      contentType: file.type,
    });
    if (!check.ok) {
      setError(check.error ?? "Invalid file.");
      return;
    }

    setBusy(true);
    try {
      // Read text from text-type files for auto-extraction; otherwise fall back
      // to whatever the analyst pasted.
      let docText = text.trim();
      if (!docText && file.type.startsWith("text/")) {
        docText = (await file.text()).slice(0, 500_000);
      }

      // Best-effort upload to Storage — if the bucket isn't configured we still
      // record the document + extracted financials (storagePath null).
      let storagePath: string | null = null;
      try {
        const path = `${companyId}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await createClient()
          .storage.from(STORAGE_BUCKET)
          .upload(path, file, { contentType: file.type || undefined });
        if (!upErr) storagePath = path;
      } catch {
        // storage not configured — proceed with metadata only
      }

      const { document } = await api.addDocument(companyId, {
        name: file.name,
        kind,
        storagePath,
        contentType: file.type || null,
        sizeBytes: file.size,
        text: docText || undefined,
      });
      setDocs((prev) => [document, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof BackendOff
          ? "Uploading documents requires live mode."
          : "Upload failed. Please retry."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(docId: string) {
    try {
      await api.deleteDocument(companyId, docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      // no-op
    }
  }

  if (backendOff && docs.length === 0) {
    return <p className="text-[12px] text-subtle">Document uploads require live mode.</p>;
  }

  return (
    <div className="space-y-3">
      {docs.length === 0 && !showForm && (
        <p className="text-[12px] text-subtle">No documents uploaded yet.</p>
      )}

      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="rounded-md border border-[var(--border)] bg-[#FAFAF8] p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex shrink-0 items-center rounded-full bg-[#EEF1F6] px-1.5 py-0.5 text-[10px] font-medium text-[#0C447C]">
                      {DOCUMENT_KIND_LABELS[d.kind]}
                    </span>
                    <p className="truncate text-[12px] font-medium text-ink">{d.name}</p>
                  </div>
                  {d.sizeBytes != null && (
                    <p className="mt-0.5 text-[11px] text-subtle">
                      {formatBytes(d.sizeBytes)}
                      {!d.storagePath && " · metadata only"}
                    </p>
                  )}
                  {d.extracted && hasAnyFinancials(d.extracted) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {d.extracted.revenue && (
                        <Chip label="Rev" value={d.extracted.revenue} />
                      )}
                      {d.extracted.ebitda && (
                        <Chip label="EBITDA" value={d.extracted.ebitda} />
                      )}
                      {d.extracted.margin && (
                        <Chip label="Margin" value={d.extracted.margin} />
                      )}
                      {d.extracted.multiple && (
                        <Chip label="Multiple" value={d.extracted.multiple} />
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void handleDelete(d.id)}
                  aria-label={`Delete ${d.name}`}
                  className="shrink-0 text-[11px] text-subtle hover:text-[#C0322F]"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2.5">
          <div>
            <label className="mb-1 block text-[11px] text-subtle" htmlFor="doc-file">
              File
            </label>
            <input
              id="doc-file"
              ref={fileRef}
              type="file"
              className="w-full text-[12px] text-ink"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-subtle" htmlFor="doc-kind">
              Type
            </label>
            <select
              id="doc-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
              className="w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] text-ink"
            >
              {DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DOCUMENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-subtle" htmlFor="doc-text">
              Document text for auto-extraction (optional)
            </label>
            <textarea
              id="doc-text"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste key text (e.g. the financial highlights) to auto-extract revenue, EBITDA, margin and multiple."
              className="w-full rounded border border-[var(--border)] bg-white px-2 py-1.5 text-[12px] text-ink"
            />
          </div>
          {error && <p className="text-[12px] text-[#C0322F]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-[#185FA5] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
                setError(null);
              }}
              className="text-[12px] text-subtle hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-[12px] font-medium text-[#185FA5] hover:underline"
        >
          + Upload document
        </button>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[#F1EFE8] px-1.5 py-0.5 text-[11px]">
      <span className="text-subtle">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </span>
  );
}
