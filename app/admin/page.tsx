"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { PipelineStatusRow } from "@/components/ui/PipelineStatusRow";
import { MetricCard } from "@/components/ui/MetricCard";
import { SettingsIcon, PlusIcon, XIcon } from "@/components/ui/icons";
import { mockUsers } from "@/lib/mock-data";
import { useLive } from "@/lib/use-live";
import {
  api,
  BackendOff,
  type OrgView,
  type FailureView,
  type AuditEntryView,
} from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface UserRow {
  id?: string;
  name: string;
  email: string;
  role: string;
  lastActive: string;
}

const MOCK_USERS: UserRow[] = mockUsers;

export default function AdminPage() {
  const live = useLive(
    "admin-users",
    async () => {
      const { users } = (await api.adminUsers()) as {
        users: {
          id: string;
          name: string;
          email: string;
          role: string;
          lastActive: string | null;
        }[];
      };
      return users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        lastActive: u.lastActive ? formatDate(u.lastActive) : "—",
      }));
    },
    MOCK_USERS
  );

  const [rows, setRows] = useState<UserRow[]>(MOCK_USERS);
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  useEffect(() => {
    setRows(live.data);
  }, [live.data]);

  // Organization (settings + member count). Null in single-tenant / mock mode.
  const orgLive = useLive("admin-org", () => api.getOrg(), {
    org: null as OrgView | null,
  });
  const isLive = live.source === "live";
  const seatFull =
    !!orgLive.data.org &&
    orgLive.data.org.seatLimit != null &&
    orgLive.data.org.seatsUsed >= orgLive.data.org.seatLimit;

  function removeUser(row: UserRow) {
    if (!row.id) return;
    const prev = rows;
    setRows((r) => r.filter((x) => x.email !== row.email));
    if (isLive) {
      api.removeUser(row.id).catch((e) => {
        if (!(e instanceof BackendOff)) setRows(prev); // restore on failure
      });
    }
  }

  // Live system stats + pipeline health (mock numbers as fallback).
  const statsLive = useLive("admin-stats", () => api.adminStats(), {
    stats: null as null | {
      totalCompanies: number;
      signalsThisWeek: number;
      llmCallsThisWeek: number;
      avgConfidence: number | null;
    },
    pipelines: [] as {
      pipeline: string;
      ranAt: string;
      records: number;
      errors: number;
      ok: boolean;
    }[],
  });
  const s = statsLive.data.stats;
  const pl = (name: string) => statsLive.data.pipelines.find((p) => p.pipeline === name);

  function changeRole(row: UserRow, role: string) {
    if (role === row.role) return;
    setRows((prev) => prev.map((r) => (r.email === row.email ? { ...r, role } : r)));
    if (live.source === "live" && row.id) {
      api.setUserRole(row.id, role).catch((e) => {
        if (!(e instanceof BackendOff)) {
          setRows((prev) =>
            prev.map((r) => (r.email === row.email ? { ...r, role: row.role } : r))
          );
        }
      });
    }
  }

  function addUser(u: UserRow) {
    setRows((prev) => [u, ...prev]);
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <SettingsIcon className="h-[18px] w-[18px] text-muted" />
        <h1 className="text-[18px] font-medium text-ink">Admin</h1>
      </div>

      {/* pipeline health */}
      <section className="mb-8">
        <h2 className="mb-3 text-[14px] font-medium text-ink">Pipeline health</h2>
        <div className="space-y-2.5">
          <PipelineStatusRow
            name="Carveout pipeline"
            lastRun={ago(pl("carveouts")?.ranAt)}
            records={pl("carveouts")?.records ?? 0}
            errors={pl("carveouts")?.errors ?? 0}
            schedule="Every 6 hours (0 */6 * * *)"
            onRun={() => {
              api.triggerPipeline("carveouts").catch(() => {});
            }}
          />
          <PipelineStatusRow
            name="Private asset pipeline"
            lastRun={ago(pl("private-assets")?.ranAt)}
            records={pl("private-assets")?.records ?? 0}
            errors={pl("private-assets")?.errors ?? 0}
            schedule="Every 12 hours (0 */12 * * *)"
            onRun={() => {
              api.triggerPipeline("private-assets").catch(() => {});
            }}
          />
        </div>
      </section>

      {/* organization */}
      {orgLive.data.org && <OrgSettings org={orgLive.data.org} live={isLive} />}

      {/* system stats */}
      <section className="mb-8">
        <h2 className="mb-3 text-[14px] font-medium text-ink">System stats</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Total companies tracked"
            value={s ? s.totalCompanies.toLocaleString() : "1,084"}
          />
          <MetricCard
            label="Signals processed this week"
            value={s ? String(s.signalsThisWeek) : "892"}
          />
          <MetricCard
            label="LLM calls this week"
            value={s ? String(s.llmCallsThisWeek) : "341"}
          />
          <MetricCard
            label="Avg. extraction confidence"
            value={s?.avgConfidence != null ? s.avgConfidence.toFixed(2) : "0.81"}
          />
        </div>
      </section>

      {/* users */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-ink">Users</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              disabled={seatFull}
              title={seatFull ? "Seat limit reached — upgrade or add seats" : undefined}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "#185FA5" }}
            >
              <PlusIcon className="h-3.5 w-3.5" /> Invite user
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
              style={{ border: "0.5px solid var(--border)" }}
            >
              Add directly
            </button>
          </div>
        </div>
        <div
          className="overflow-hidden rounded-lg bg-surface"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11px] font-normal uppercase tracking-wide text-subtle">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Last active</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.email} style={{ borderTop: "0.5px solid var(--border)" }}>
                  <Td className="font-medium text-ink">{u.name}</Td>
                  <Td className="text-muted">{u.email}</Td>
                  <Td>
                    <select
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="rounded-md bg-surface px-2 py-1 text-[12px] font-medium text-ink focus:outline-none"
                      style={{ border: "0.5px solid var(--border)" }}
                    >
                      <option value="analyst">analyst</option>
                      <option value="admin">admin</option>
                    </select>
                  </Td>
                  <Td className="text-muted">{u.lastActive}</Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={() => removeUser(u)}
                      aria-label={`Remove ${u.email}`}
                      title="Remove user"
                      className="text-subtle hover:text-[#791F1F]"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* dead-letter — failed signals (live mode only, hidden when empty) */}
      <FailuresSection live={isLive} />

      {/* audit trail export (live mode only) */}
      <AuditSection live={isLive} />

      {showAdd && (
        <AddUserModal
          live={live.source === "live"}
          onClose={() => setShowAdd(false)}
          onAdded={addUser}
        />
      )}

      {showInvite && (
        <InviteModal
          live={isLive}
          onClose={() => setShowInvite(false)}
          onInvited={addUser}
        />
      )}
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

// Dead-letter: signals the pipeline couldn't process. Replay re-runs extraction;
// dismiss discards. Hidden in mock mode and when the queue is empty.
function FailuresSection({ live }: { live: boolean }) {
  const failuresLive = useLive("admin-failures", () => api.adminFailures(), {
    failures: [] as FailureView[],
  });
  const [rows, setRows] = useState<FailureView[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setRows(failuresLive.data.failures), [failuresLive.data]);

  if (!live || rows.length === 0) return null;

  async function replay(id: string) {
    setBusy(id);
    try {
      const { ok } = await api.replayFailure(id);
      if (ok) setRows((r) => r.filter((x) => x.id !== id));
    } catch {
      /* leave the row for another attempt */
    }
    setBusy(null);
  }

  async function dismiss(id: string) {
    setBusy(id);
    try {
      await api.dismissFailure(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch {
      /* keep the row */
    }
    setBusy(null);
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[14px] font-medium text-ink">
        Failed signals (dead-letter)
        <span className="ml-2 rounded-full bg-[#FCEBEB] px-1.5 py-0.5 text-[10px] font-medium text-[#791F1F]">
          {rows.length}
        </span>
      </h2>
      <div
        className="overflow-hidden rounded-lg bg-surface"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11px] font-normal uppercase tracking-wide text-subtle">
              <Th>Source</Th>
              <Th>Reason</Th>
              <Th>Excerpt</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} style={{ borderTop: "0.5px solid var(--border)" }}>
                <Td className="text-muted">{f.sourceName ?? f.sourceType ?? "—"}</Td>
                <Td className="font-medium text-[#791F1F]">{f.reason ?? "—"}</Td>
                <Td className="max-w-[320px] truncate text-subtle">{f.excerpt}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => replay(f.id)}
                      disabled={busy === f.id}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                      style={{ backgroundColor: "#185FA5" }}
                    >
                      {busy === f.id ? "…" : "Replay"}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(f.id)}
                      disabled={busy === f.id}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-muted hover:text-ink disabled:opacity-40"
                      style={{ border: "0.5px solid var(--border)" }}
                    >
                      Dismiss
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Compliance export: download the org's audit trail as CSV. Live mode only —
// the endpoint is admin-gated and needs the backend; in mock mode there's
// nothing to export, so the section is hidden.
function AuditSection({ live }: { live: boolean }) {
  const [entries, setEntries] = useState<AuditEntryView[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!live) return;
    api
      .auditLog(50)
      .then((r) => {
        setEntries(r.entries);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [live]);

  if (!live) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-medium text-ink">Audit log</h2>
          <p className="text-[11px] text-muted">
            Append-only record of admin + analyst actions, scoped to this workspace.
          </p>
        </div>
        <a
          href="/api/admin/audit/export"
          download
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
          style={{ border: "0.5px solid var(--border)" }}
        >
          Export CSV
        </a>
      </div>

      {loaded && (
        <div
          className="overflow-x-auto rounded-lg bg-surface"
          style={{ border: "0.5px solid var(--border)" }}
        >
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-muted">No audit entries yet.</p>
          ) : (
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-[10px] font-normal uppercase tracking-wide text-subtle">
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Actor</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderTop: "0.5px solid var(--border)" }}>
                    <Td>
                      <code className="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-[11px] text-ink">
                        {e.action}
                      </code>
                    </Td>
                    <Td className="text-muted">
                      {e.entityType && e.entityId
                        ? `${e.entityType}/${e.entityId.slice(0, 8)}…`
                        : "—"}
                    </Td>
                    <Td className="text-muted">{e.actorEmail ?? "system"}</Td>
                    <Td className="text-muted">{formatDate(e.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

function OrgSettings({ org, live }: { org: OrgView; live: boolean }) {
  const [name, setName] = useState(org.name);
  const [saved, setSaved] = useState(org.name);
  const [busy, setBusy] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const dirty = name.trim() !== saved && name.trim().length > 0;

  async function save() {
    if (!dirty) return;
    setBusy(true);
    if (live) {
      try {
        await api.renameOrg(name.trim());
        setSaved(name.trim());
      } catch (e) {
        if (!(e instanceof BackendOff)) setName(saved); // revert on failure
      }
    } else {
      setSaved(name.trim());
    }
    setBusy(false);
  }

  async function upgrade(plan: "pro" | "enterprise") {
    if (!live) return;
    setBillingBusy(true);
    try {
      const { url } = await api.billingCheckout(plan);
      if (url) window.location.href = url;
      else setBillingBusy(false);
    } catch {
      setBillingBusy(false); // billing not configured / error — stay on page
    }
  }

  async function manageBilling() {
    if (!live) return;
    setBillingBusy(true);
    try {
      const { url } = await api.billingPortal();
      if (url) window.location.href = url;
      else setBillingBusy(false);
    } catch {
      setBillingBusy(false);
    }
  }

  const [scim, setScim] = useState<{ token: string; scimBaseUrl: string } | null>(null);
  const [scimBusy, setScimBusy] = useState(false);
  async function genScim() {
    if (!live) return;
    setScimBusy(true);
    try {
      setScim(await api.generateScimToken());
    } catch {
      /* not configured / error */
    }
    setScimBusy(false);
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[14px] font-medium text-ink">Organization</h2>
      <div
        className="flex flex-wrap items-end gap-3 rounded-lg bg-surface p-4"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="flex-1 min-w-[220px]">
          <label className="mb-1 block text-[11px] font-normal text-muted">
            Workspace name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
            style={{ border: "0.5px solid var(--border)" }}
          />
        </div>
        <div className="text-[12px] text-muted">
          {org.seatLimit != null
            ? `${org.seatsUsed} / ${org.seatLimit} seats`
            : `${org.memberCount} ${org.memberCount === 1 ? "member" : "members"}`}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "#185FA5" }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      {/* billing */}
      <div
        className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-surface p-4"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="flex-1 min-w-[200px]">
          <div className="text-[11px] font-normal text-muted">Plan</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: "#EEEDFE", color: "#3C3489" }}
            >
              {PLAN_LABELS[org.plan] ?? org.plan}
            </span>
            {org.subscriptionStatus && org.subscriptionStatus !== "active" && (
              <span className="text-[11px] text-[#791F1F]">{org.subscriptionStatus}</span>
            )}
          </div>
        </div>

        {org.plan === "free" ? (
          <>
            <button
              type="button"
              onClick={() => upgrade("pro")}
              disabled={billingBusy}
              className="rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "#185FA5" }}
            >
              Upgrade to Pro
            </button>
            <button
              type="button"
              onClick={() => upgrade("enterprise")}
              disabled={billingBusy}
              className="rounded-md px-3 py-2 text-[12px] font-medium text-muted hover:text-ink disabled:opacity-40"
              style={{ border: "0.5px solid var(--border)" }}
            >
              Enterprise
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={manageBilling}
            disabled={billingBusy}
            className="rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: "#185FA5" }}
          >
            Manage billing
          </button>
        )}
      </div>

      {/* SCIM provisioning (enterprise) */}
      <div
        className="mt-3 rounded-lg bg-surface p-4"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[12px] font-medium text-ink">SCIM provisioning</div>
            <div className="text-[11px] text-muted">
              Auto-provision members from your identity provider (Okta, Azure AD).
            </div>
          </div>
          <button
            type="button"
            onClick={genScim}
            disabled={scimBusy}
            className="rounded-md px-3 py-2 text-[12px] font-medium text-muted hover:text-ink disabled:opacity-40"
            style={{ border: "0.5px solid var(--border)" }}
          >
            {scimBusy ? "…" : scim ? "Regenerate token" : "Generate SCIM token"}
          </button>
        </div>
        {scim && (
          <div className="mt-3">
            <div className="text-[11px] text-muted">
              Base URL: <code className="text-ink">{scim.scimBaseUrl}</code>
            </div>
            <textarea
              readOnly
              value={scim.token}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 h-16 w-full rounded-md bg-surface px-3 py-2 text-[11px] text-ink focus:outline-none"
              style={{ border: "0.5px solid var(--border)" }}
            />
            <p className="mt-1 text-[10px] text-subtle">
              Shown once — paste it into your IdP&apos;s SCIM settings now.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function InviteModal({
  live,
  onClose,
  onInvited,
}: {
  live: boolean;
  onClose: () => void;
  onInvited: (u: UserRow) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("analyst");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useFocusTrap(dialogRef, onClose);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const row: UserRow = {
      name: email.split("@")[0]!,
      email,
      role,
      lastActive: "Invited",
    };

    if (live) {
      try {
        const res = await api.inviteUser({ email, role });
        onInvited(row);
        // No email transport configured → surface the link so the admin can share it.
        if (!res.emailed && res.actionLink) {
          setLink(res.actionLink);
          setBusy(false);
          return;
        }
        onClose();
        return;
      } catch (err) {
        if (!(err instanceof BackendOff)) {
          setError(err instanceof Error ? err.message : "Failed to send invite");
          setBusy(false);
          return;
        }
      }
    }
    // mock mode → add locally
    onInvited(row);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Invite user"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-surface p-5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-ink">Invite user</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-subtle hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {link ? (
          <div>
            <p className="mb-2 text-[12px] text-muted">
              Email isn&apos;t configured, so share this invite link directly:
            </p>
            <textarea
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="mb-4 h-24 w-full rounded-md bg-surface px-3 py-2 text-[11px] text-ink focus:outline-none"
              style={{ border: "0.5px solid var(--border)" }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
                style={{ backgroundColor: "#185FA5" }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <ModalField label="Email" value={email} onChange={setEmail} type="email" />
            <label className="mb-1 block text-[11px] font-normal text-muted">Role</label>
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
              style={{ border: "0.5px solid var(--border)" }}
            >
              <option value="analyst">analyst</option>
              <option value="admin">admin</option>
            </select>

            {error && <p className="mb-3 text-[12px] text-[#791F1F]">{error}</p>}

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
                type="submit"
                disabled={busy}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#185FA5" }}
              >
                {busy ? "Sending…" : "Send invite"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function AddUserModal({
  live,
  onClose,
  onAdded,
}: {
  live: boolean;
  onClose: () => void;
  onAdded: (u: UserRow) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("analyst");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useFocusTrap(dialogRef, onClose);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);

    const row: UserRow = {
      name: name.trim() || email.split("@")[0]!,
      email,
      role,
      lastActive: "—",
    };

    if (live) {
      try {
        const { user } = (await api.createUser({ email, password, role, name })) as {
          user: UserRow;
        };
        onAdded({ ...user, lastActive: "—" });
        onClose();
        return;
      } catch (err) {
        if (!(err instanceof BackendOff)) {
          setError(err instanceof Error ? err.message : "Failed to create user");
          setBusy(false);
          return;
        }
      }
    }
    // mock mode (or backend off) → add locally
    onAdded(row);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add user"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-surface p-5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-ink">Add user</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-subtle hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <ModalField
          label="Name"
          value={name}
          onChange={setName}
          type="text"
          required={false}
        />
        <ModalField label="Email" value={email} onChange={setEmail} type="email" />
        <ModalField
          label="Temporary password"
          value={password}
          onChange={setPassword}
          type="password"
          hint="At least 8 characters"
        />

        <label className="mb-1 block text-[11px] font-normal text-muted">Role</label>
        <select
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mb-4 w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <option value="analyst">analyst</option>
          <option value="admin">admin</option>
        </select>

        {error && <p className="mb-3 text-[12px] text-[#791F1F]">{error}</p>}

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
            type="submit"
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#185FA5" }}
          >
            {busy ? "Adding…" : "Add user"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  type,
  hint,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-[11px] font-normal text-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none"
        style={{ border: "0.5px solid var(--border)" }}
      />
      {hint && <p className="mt-1 text-[10px] font-normal text-subtle">{hint}</p>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-normal">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className ?? ""}`}>{children}</td>;
}

function ago(iso?: string): string {
  if (!iso) return "Never run";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} hours ago`;
  return `${Math.floor(d / 86400)} days ago`;
}
