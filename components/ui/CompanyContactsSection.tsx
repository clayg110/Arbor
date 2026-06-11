"use client";

import { useState, useEffect } from "react";
import { api, BackendOff } from "@/lib/api-client";
import {
  CONTACT_ROLES,
  roleColor,
  contactInitials,
  type CompanyContact,
  type ContactRole,
} from "@/lib/contacts";

interface Props {
  companyId: string;
  fallback?: CompanyContact[];
}

function RoleBadge({ role }: { role: ContactRole }) {
  const c = roleColor(role);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {role}
    </span>
  );
}

export function CompanyContactsSection({ companyId, fallback = [] }: Props) {
  const [contacts, setContacts] = useState<CompanyContact[]>(fallback);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<ContactRole>("M&A Advisor");

  useEffect(() => {
    api
      .companyContacts(companyId)
      .then((res) => {
        setContacts(res.contacts);
        setSuggestions(res.suggestions);
        setLive(true);
      })
      .catch((e) => {
        if (!(e instanceof BackendOff)) setLive(false);
      });
  }, [companyId]);

  function resetForm() {
    setName("");
    setFirm("");
    setTitle("");
    setRole("M&A Advisor");
    setAdding(false);
  }

  async function handleAdd(prefillFirm?: string) {
    const finalName = name.trim();
    const finalFirm = (prefillFirm ?? firm).trim();
    // Suggestion chips create a firm-only advisor record when no name is typed.
    const useName = finalName || finalFirm;
    if (!useName || busy) return;
    setBusy(true);
    try {
      const { contact } = await api.addCompanyContact(companyId, {
        name: useName,
        firm: finalFirm || null,
        title: title.trim() || null,
        role: prefillFirm ? "M&A Advisor" : role,
      });
      setContacts((prev) =>
        [...prev, contact].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSuggestions((prev) => prev.filter((s) => s !== prefillFirm));
      resetForm();
    } catch {
      // ignore — mock mode or transient failure
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(linkId: string) {
    const prev = contacts;
    setContacts((c) => c.filter((x) => x.linkId !== linkId));
    try {
      await api.removeCompanyContact(companyId, linkId);
    } catch {
      setContacts(prev);
    }
  }

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !adding ? (
        <p className="text-[12px] text-muted">No contacts linked yet.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={c.linkId}
              className="flex items-start gap-2.5 rounded border border-[#e5e5e2] px-3 py-2"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1EFE8] text-[10px] font-semibold text-[#444441]">
                {contactInitials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">{c.name}</span>
                  <RoleBadge role={c.role} />
                </div>
                <p className="text-[11px] text-muted">
                  {[c.title, c.firm].filter(Boolean).join(" · ") || "—"}
                </p>
                {(c.email || c.phone) && (
                  <p className="mt-0.5 text-[11px] text-subtle">
                    {[c.email, c.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {live && (
                <button
                  onClick={() => handleRemove(c.linkId)}
                  className="text-[11px] text-subtle hover:text-[#C0322F]"
                  aria-label={`Remove ${c.name}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* suggestions */}
      {live && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-subtle">From signals:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleAdd(s)}
              disabled={busy}
              className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11px] font-medium text-[#1d4ed8] hover:bg-[#dbeafe]"
            >
              + {s} (advisor)
            </button>
          ))}
        </div>
      )}

      {/* add form */}
      {live &&
        (adding ? (
          <div className="space-y-2 rounded border border-[#e5e5e2] bg-[#fafaf8] p-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                autoFocus
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded border border-[#e5e5e2] px-2 py-1 text-[12px] outline-none focus:border-[#185FA5]"
              />
              <input
                placeholder="Firm"
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
                className="rounded border border-[#e5e5e2] px-2 py-1 text-[12px] outline-none focus:border-[#185FA5]"
              />
              <input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded border border-[#e5e5e2] px-2 py-1 text-[12px] outline-none focus:border-[#185FA5]"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ContactRole)}
                className="rounded border border-[#e5e5e2] px-2 py-1 text-[12px] outline-none focus:border-[#185FA5]"
                aria-label="Role"
              >
                {CONTACT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAdd()}
                disabled={busy || !name.trim()}
                className="rounded bg-[#185FA5] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#1450a0] disabled:opacity-50"
              >
                Add contact
              </button>
              <button
                onClick={resetForm}
                className="text-[11px] text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#185FA5]"
            style={{ border: "0.5px solid var(--border)" }}
          >
            + Add contact
          </button>
        ))}
    </div>
  );
}
