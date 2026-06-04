"use client";

import { useEffect, useState } from "react";
import { PipelineStatusRow } from "@/components/ui/PipelineStatusRow";
import { MetricCard } from "@/components/ui/MetricCard";
import { SettingsIcon, PlusIcon, XIcon } from "@/components/ui/icons";
import { mockUsers } from "@/lib/mock-data";
import { useLive } from "@/lib/use-live";
import { api, BackendOff } from "@/lib/api-client";
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
        users: { id: string; name: string; email: string; role: string; lastActive: string | null }[];
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
  useEffect(() => {
    setRows(live.data);
  }, [live.data]);

  // Live system stats + pipeline health (mock numbers as fallback).
  const statsLive = useLive(
    "admin-stats",
    () => api.adminStats(),
    {
      stats: null as null | {
        totalCompanies: number;
        signalsThisWeek: number;
        llmCallsThisWeek: number;
        avgConfidence: number | null;
      },
      pipelines: [] as { pipeline: string; ranAt: string; records: number; errors: number; ok: boolean }[],
    }
  );
  const s = statsLive.data.stats;
  const pl = (name: string) => statsLive.data.pipelines.find((p) => p.pipeline === name);

  function changeRole(row: UserRow, role: string) {
    if (role === row.role) return;
    setRows((prev) => prev.map((r) => (r.email === row.email ? { ...r, role } : r)));
    if (live.source === "live" && row.id) {
      api.setUserRole(row.id, role).catch((e) => {
        if (!(e instanceof BackendOff)) {
          setRows((prev) => prev.map((r) => (r.email === row.email ? { ...r, role: row.role } : r)));
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

      {/* system stats */}
      <section className="mb-8">
        <h2 className="mb-3 text-[14px] font-medium text-ink">System stats</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Total companies tracked" value={s ? s.totalCompanies.toLocaleString() : "1,084"} />
          <MetricCard label="Signals processed this week" value={s ? String(s.signalsThisWeek) : "892"} />
          <MetricCard label="LLM calls this week" value={s ? String(s.llmCallsThisWeek) : "341"} />
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
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white"
            style={{ backgroundColor: "#185FA5" }}
          >
            <PlusIcon className="h-3.5 w-3.5" /> Add user
          </button>
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
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.email} style={{ borderTop: "0.5px solid var(--border)" }}>
                  <Td className="font-medium text-ink">{u.name}</Td>
                  <Td className="text-muted">{u.email}</Td>
                  <Td>
                    <select
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd && (
        <AddUserModal
          live={live.source === "live"}
          onClose={() => setShowAdd(false)}
          onAdded={addUser}
        />
      )}
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);

    const row: UserRow = {
      name: name.trim() || email.split("@")[0],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-surface p-5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-ink">Add user</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-subtle hover:text-ink">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <ModalField label="Name" value={name} onChange={setName} type="text" required={false} />
        <ModalField label="Email" value={email} onChange={setEmail} type="email" />
        <ModalField label="Temporary password" value={password} onChange={setPassword} type="password" hint="At least 8 characters" />

        <label className="mb-1 block text-[11px] font-normal text-muted">Role</label>
        <select
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
  return (
    <div className="mb-4">
      <label className="mb-1 block text-[11px] font-normal text-muted">{label}</label>
      <input
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
