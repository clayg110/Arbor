"use client";

import { useMemo, useState } from "react";
import { useLive } from "@/lib/use-live";
import { api } from "@/lib/api-client";
import { mockContacts, mockFirmActivity, mockContactLinks } from "@/lib/mock-data";
import { radarCompanies } from "@/lib/radar-data";
import { contactInitials, type Contact } from "@/lib/contacts";
import {
  buildCoverageMap,
  coverageSummary,
  warmIntros,
  type GraphCompany,
  type GraphContact,
} from "@/lib/relationship-graph";
import { safeHttpUrl } from "@/lib/safe-url";

type Tab = "directory" | "banker" | "coverage";

export default function ContactsPage() {
  const live = useLive("contacts", () => api.listContacts(), {
    contacts: mockContacts,
  });
  const firmsLive = useLive("contact-firms", () => api.firmActivity(), {
    firms: mockFirmActivity,
  });
  const companiesLive = useLive("contacts-companies", () => api.companies("?limit=500"), {
    companies: radarCompanies,
    total: radarCompanies.length,
    summary: null,
    sectorSummary: [],
  });

  const [tab, setTab] = useState<Tab>("directory");
  const [search, setSearch] = useState("");
  const [firm, setFirm] = useState<string>("all");

  const contacts = live.data.contacts;
  const firmOptions = useMemo(
    () =>
      Array.from(new Set(contacts.map((c) => c.firm).filter(Boolean) as string[])).sort(),
    [contacts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (firm !== "all" && c.firm !== firm) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.firm ?? "").toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, firm]);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-[18px] font-medium text-ink">Contacts</h1>
        {!live.loading && (
          <span className="rounded-full bg-[#F1EFE8] px-2 py-0.5 text-[11px] font-medium text-[#444441]">
            {contacts.length}
          </span>
        )}
      </div>
      <p className="mb-5 text-[13px] font-normal text-muted">
        Advisors, bankers, executives and counsel across your deal network.
      </p>

      {/* tabs */}
      <div
        className="mb-4 inline-flex rounded-md p-0.5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <TabButton active={tab === "directory"} onClick={() => setTab("directory")}>
          Directory
        </TabButton>
        <TabButton active={tab === "banker"} onClick={() => setTab("banker")}>
          Banker intelligence
        </TabButton>
        <TabButton active={tab === "coverage"} onClick={() => setTab("coverage")}>
          Coverage map
        </TabButton>
      </div>

      {tab === "directory" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              placeholder="Search name, firm, title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-md px-3 py-1.5 text-[13px] outline-none focus:border-[#185FA5]"
              style={{ border: "0.5px solid var(--border)" }}
              aria-label="Search contacts"
            />
            <select
              value={firm}
              onChange={(e) => setFirm(e.target.value)}
              className="rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#185FA5]"
              style={{ border: "0.5px solid var(--border)" }}
              aria-label="Filter by firm"
            >
              <option value="all">All firms</option>
              {firmOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted">No contacts found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <ContactCard key={c.id} contact={c} />
              ))}
            </div>
          )}
        </>
      ) : tab === "banker" ? (
        <BankerTable firms={firmsLive.data.firms} />
      ) : (
        <CoverageTab
          companies={companiesLive.data.companies.map((c) => ({
            companyId: c.companyId ?? c.id,
            name: c.name,
            owner: c.ownerName,
            stage: c.stage,
          }))}
          contacts={contacts.map((c) => ({ id: c.id, name: c.name, firm: c.firm }))}
        />
      )}
    </div>
  );
}

function CoverageTab({
  companies,
  contacts,
}: {
  companies: GraphCompany[];
  contacts: GraphContact[];
}) {
  const rows = useMemo(
    () => buildCoverageMap(companies, contacts, mockContactLinks),
    [companies, contacts]
  );
  const summary = useMemo(() => coverageSummary(rows), [rows]);

  // Warm-intro finder: pick an active deal, see who can get us in.
  const activeDeals = useMemo(
    () =>
      companies
        .filter((c) => c.stage === "in_market" || c.stage === "monitor_for_exit")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [companies]
  );
  const [targetId, setTargetId] = useState<string>(activeDeals[0]?.companyId ?? "");
  const target = activeDeals.find((c) => c.companyId === targetId) ?? activeDeals[0];
  const intros = useMemo(
    () =>
      target
        ? warmIntros(
            { companyId: target.companyId, owner: target.owner },
            contacts,
            mockContactLinks
          )
        : [],
    [target, contacts]
  );

  return (
    <div className="space-y-6">
      {/* summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Deal owners" value={String(summary.owners)} />
        <Stat label="With a relationship" value={String(summary.covered)} />
        <Stat label="Coverage" value={`${summary.coverageRatio}%`} />
        <Stat
          label="Active gaps"
          value={String(summary.activeGaps)}
          alert={summary.activeGaps > 0}
        />
      </div>

      {/* warm-intro finder */}
      <section
        className="rounded-lg bg-surface p-4"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-medium text-ink">Find a warm intro</h2>
          <label className="flex items-center gap-2 text-[12px] text-muted">
            Deal
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded-md px-2 py-1 text-[13px] text-ink outline-none focus:border-[#185FA5]"
              style={{ border: "0.5px solid var(--border)" }}
              aria-label="Choose a deal to find a warm introduction"
            >
              {activeDeals.map((d) => (
                <option key={d.companyId} value={d.companyId}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {intros.length === 0 ? (
          <p className="mt-3 text-[13px] text-subtle">
            No known route in{target ? ` to ${target.owner}` : ""}. This owner is a
            relationship gap — worth a targeted intro.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {intros.slice(0, 5).map((i) => (
              <li
                key={i.contactId}
                className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
                style={{ border: "0.5px solid var(--border)" }}
              >
                <span className="min-w-0">
                  <span className="text-[13px] font-medium text-ink">
                    {i.contactName}
                  </span>
                  <span className="ml-2 text-[12px] text-muted">{i.reason}</span>
                </span>
                <span className="shrink-0 text-[12px] font-medium text-[#157A5A]">
                  {i.score}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* coverage table */}
      <div
        className="overflow-hidden rounded-lg"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-[#fafaf8] text-[11px] uppercase tracking-wide text-subtle">
              <th className="px-4 py-2 font-medium">Deal owner</th>
              <th className="px-4 py-2 text-right font-medium">Deals</th>
              <th className="px-4 py-2 text-right font-medium">Active</th>
              <th className="px-4 py-2 font-medium">Relationship</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.owner} className="border-t border-[#f0f0ee]">
                <td className="px-4 py-2.5 font-medium text-ink">{r.owner}</td>
                <td className="px-4 py-2.5 text-right text-muted">{r.companies}</td>
                <td className="px-4 py-2.5 text-right text-muted">{r.activeCompanies}</td>
                <td className="px-4 py-2.5">
                  {r.covered ? (
                    <span className="text-[12px] text-ink">
                      {r.contacts
                        .slice(0, 2)
                        .map((c) => c.name)
                        .join(", ")}
                      {r.contacts.length > 2 && ` +${r.contacts.length - 2}`}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: r.activeCompanies > 0 ? "#FBECEB" : "#F1EFE8",
                        color: r.activeCompanies > 0 ? "#9A2622" : "#555550",
                      }}
                    >
                      {r.activeCompanies > 0
                        ? "Gap — no relationship"
                        : "No relationship"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className="rounded-lg bg-surface px-4 py-3"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <p className="text-[11px] font-normal text-muted">{label}</p>
      <p
        className="mt-0.5 text-[20px] font-medium leading-tight"
        style={{ color: alert ? "#9A2622" : "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded px-3 py-1 text-[12px] font-medium transition-colors"
      style={
        active
          ? { backgroundColor: "#185FA5", color: "white" }
          : { color: "var(--text-muted)" }
      }
    >
      {children}
    </button>
  );
}

function ContactCard({ contact: c }: { contact: Contact }) {
  return (
    <div className="rounded-lg border border-[#e5e5e2] bg-surface p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F1EFE8] text-[12px] font-semibold text-[#444441]">
          {contactInitials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">{c.name}</p>
          <p className="text-[12px] text-muted">
            {[c.title, c.firm].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>
      {(c.email || c.phone || c.linkedinUrl) && (
        <div className="mt-2.5 space-y-0.5 text-[12px]">
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              className="block truncate text-[#185FA5] hover:underline"
            >
              {c.email}
            </a>
          )}
          {c.phone && <p className="text-subtle">{c.phone}</p>}
          {safeHttpUrl(c.linkedinUrl) && (
            <a
              href={safeHttpUrl(c.linkedinUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[#185FA5] hover:underline"
            >
              LinkedIn
            </a>
          )}
        </div>
      )}
      {c.notes && <p className="mt-2 text-[12px] text-muted">{c.notes}</p>}
    </div>
  );
}

function BankerTable({
  firms,
}: {
  firms: { firm: string; processCount: number; contacts: number }[];
}) {
  if (firms.length === 0) {
    return (
      <p className="py-16 text-center text-[13px] text-muted">
        No M&amp;A advisor relationships tracked yet. Tag contacts as “M&amp;A Advisor” on
        company profiles to build this view.
      </p>
    );
  }
  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="bg-[#fafaf8] text-[11px] uppercase tracking-wide text-subtle">
            <th className="px-4 py-2 font-medium">Firm</th>
            <th className="px-4 py-2 text-right font-medium">Active processes</th>
            <th className="px-4 py-2 text-right font-medium">Contacts</th>
          </tr>
        </thead>
        <tbody>
          {firms.map((f) => (
            <tr key={f.firm} className="border-t border-[#f0f0ee]">
              <td className="px-4 py-2.5 font-medium text-ink">{f.firm}</td>
              <td className="px-4 py-2.5 text-right text-ink">{f.processCount}</td>
              <td className="px-4 py-2.5 text-right text-muted">{f.contacts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
