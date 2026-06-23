import Link from "next/link";
import { DealTypeBadge } from "./DealTypeBadge";
import { SectorBadge } from "./SectorBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { daysLabel } from "@/lib/format";
import type { Company } from "@/lib/types";

export function CompanyCard({ company }: { company: Company }) {
  return (
    <Link
      href={`/company/${company.id}`}
      className="block rounded-lg border-hairline bg-surface p-3 transition-all duration-150 hover:-translate-y-px hover:border-[#d8d5cc] hover:shadow-sm"
    >
      <div className="mb-2 text-[13px] font-medium leading-snug text-ink">
        {company.name}
      </div>
      <div className="mb-2.5 flex flex-wrap gap-1">
        <DealTypeBadge type={company.dealType} />
        <SectorBadge sector={company.sector} />
        <ConfidenceBadge confidence={company.confidence} />
      </div>
      <div className="text-[11px] font-normal text-subtle">
        {daysLabel(company.daysInStage)}
      </div>
    </Link>
  );
}
