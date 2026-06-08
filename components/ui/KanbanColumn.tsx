import { CompanyCard } from "./CompanyCard";
import { STAGE_COLORS } from "@/lib/colors";
import type { Company, Stage } from "@/lib/types";

export function KanbanColumn({
  title,
  count,
  stage,
  companies,
}: {
  title: string;
  count: number;
  stage: Stage;
  companies: Company[];
}) {
  const c = STAGE_COLORS[stage];
  return (
    <div className="flex min-w-0 flex-col">
      {/* colored header */}
      <div
        className="flex items-center justify-between rounded-t-lg px-3 py-2 text-[12px] font-medium"
        style={{ backgroundColor: c.bg, color: c.text }}
      >
        <span>{title}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: "rgba(255,255,255,0.55)", color: c.text }}
        >
          {count}
        </span>
      </div>
      {/* body */}
      <div
        className="flex flex-1 flex-col gap-2 rounded-b-lg p-2"
        style={{
          backgroundColor: "#F5F4EF",
          border: "0.5px solid var(--border)",
          borderTop: "none",
        }}
      >
        {companies.map((co) => (
          <CompanyCard key={co.id} company={co} />
        ))}
        {companies.length === 0 && (
          <p className="px-1 py-8 text-center text-[11px] text-subtle">No companies</p>
        )}
      </div>
    </div>
  );
}
