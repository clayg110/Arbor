import { PipelineStatusRow } from "@/components/ui/PipelineStatusRow";
import { MetricCard } from "@/components/ui/MetricCard";
import { SettingsIcon } from "@/components/ui/icons";
import { mockUsers } from "@/lib/mock-data";

export default function AdminPage() {
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
            lastRun="2 hours ago"
            records={47}
            errors={0}
            schedule="Every 6 hours (0 */6 * * *)"
          />
          <PipelineStatusRow
            name="Private asset pipeline"
            lastRun="6 hours ago"
            records={112}
            errors={3}
            schedule="Every 12 hours (0 */12 * * *)"
          />
        </div>
      </section>

      {/* system stats */}
      <section className="mb-8">
        <h2 className="mb-3 text-[14px] font-medium text-ink">System stats</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Total companies tracked" value="1,084" />
          <MetricCard label="Signals processed this week" value="892" />
          <MetricCard label="LLM calls this week" value="341" />
          <MetricCard label="Avg. extraction confidence" value="0.81" />
        </div>
      </section>

      {/* users */}
      <section>
        <h2 className="mb-3 text-[14px] font-medium text-ink">Users</h2>
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
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {mockUsers.map((u) => (
                <tr key={u.email} style={{ borderTop: "0.5px solid var(--border)" }}>
                  <Td className="font-medium text-ink">{u.name}</Td>
                  <Td className="text-muted">{u.email}</Td>
                  <Td>
                    <span className="rounded bg-[#F1EFE8] px-1.5 py-0.5 text-[11px] font-medium text-[#444441]">
                      {u.role}
                    </span>
                  </Td>
                  <Td className="text-muted">{u.lastActive}</Td>
                  <Td>
                    <button
                      type="button"
                      className="rounded-md px-2.5 py-1 text-[12px] font-medium text-ink"
                      style={{ border: "0.5px solid var(--border)" }}
                    >
                      Change role
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-normal">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2.5 ${className ?? ""}`}>{children}</td>;
}
