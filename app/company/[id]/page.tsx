import Link from "next/link";
import { notFound } from "next/navigation";
import { StageBadge } from "@/components/ui/StageBadge";
import { DealTypeBadge } from "@/components/ui/DealTypeBadge";
import { SectorBadge } from "@/components/ui/SectorBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { StageTimeline } from "@/components/ui/StageTimeline";
import { SignalSourceBadge } from "@/components/ui/SignalSourceBadge";
import { AnalystNoteEditor } from "@/components/ui/AnalystNoteEditor";
import { WatchlistButton } from "@/components/ui/WatchlistButton";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { MarkReviewButton } from "./MarkReviewButton";
import {
  getCompany,
  getStageHistory,
  getSignals,
  getNotes,
  getSectorPeers,
  mockCompanies,
} from "@/lib/mock-data";
import {
  SECTOR_LABELS,
  DEAL_TYPE_LABELS,
  CONFIDENCE_LABELS,
  STAGE_LABELS,
  STAGE_DOT,
} from "@/lib/colors";
import { formatDate, daysLabel } from "@/lib/format";

export function generateStaticParams() {
  return mockCompanies.map((c) => ({ id: c.id }));
}

export default function CompanyPage({ params }: { params: { id: string } }) {
  const company = getCompany(params.id);
  if (!company) notFound();

  const history = getStageHistory(company.id);
  const signals = getSignals(company.id);
  const notes = getNotes(company.id);
  const peers = getSectorPeers(company.id);

  return (
    <div>
      {/* back */}
      <Link
        href="/radar"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-normal text-muted hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Back to radar
      </Link>

      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium leading-tight text-ink">
            {company.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <DealTypeBadge type={company.dealType} />
            <SectorBadge sector={company.sector} />
            <StageBadge stage={company.currentStage} />
            <ConfidenceBadge confidence={company.confidence} />
          </div>
          <p className="mt-2 text-[12px] font-normal text-muted">
            {company.dealType === "carveout"
              ? `Parent company: ${company.parentCompany}`
              : `Sponsor: ${company.sponsorFirm}`}
          </p>
          <p className="text-[12px] font-normal text-muted">
            {daysLabel(company.daysInStage).replace(" in stage", " in current stage")} ·
            Added {formatDate(company.firstTracked)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WatchlistButton companyId={company.id} withLabel />
          <MarkReviewButton flagged={company.confidence === "needs_review"} />
        </div>
      </div>

      {/* two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* left */}
        <div className="space-y-6">
          <Section title="Stage history">
            <StageTimeline history={history} />
          </Section>

          <Section title="Key signals">
            <div className="space-y-3">
              {signals.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg bg-surface p-3"
                  style={{ border: "0.5px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink">
                      {s.title}
                    </span>
                    <span className="text-[11px] font-normal text-subtle">
                      {formatDate(s.ingestedAt)}
                    </span>
                  </div>
                  <blockquote
                    className="mt-2 rounded-r bg-[#F5F4EF] px-3 py-2 text-[12px] font-normal italic text-muted"
                    style={{ borderLeft: "2px solid var(--border)" }}
                  >
                    {s.excerpt}
                  </blockquote>
                  <div className="mt-2 flex items-center gap-2">
                    <SignalSourceBadge source={s.sourceType} />
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-normal text-[#185FA5] hover:underline"
                    >
                      View source
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Analyst notes">
            <AnalystNoteEditor initialNotes={notes} />
          </Section>
        </div>

        {/* right */}
        <div className="space-y-6">
          <Section title="Company details">
            <dl className="space-y-2.5 text-[13px]">
              <Detail label="Sector" value={SECTOR_LABELS[company.sector]} />
              <Detail label="Deal type" value={DEAL_TYPE_LABELS[company.dealType]} />
              <Detail
                label={company.dealType === "carveout" ? "Parent" : "Sponsor"}
                value={company.parentCompany ?? company.sponsorFirm ?? "—"}
              />
              <Detail label="Current stage" value={STAGE_LABELS[company.currentStage]} />
              <Detail label="Confidence" value={CONFIDENCE_LABELS[company.confidence]} />
              <Detail label="First tracked" value={formatDate(company.firstTracked)} />
              <Detail label="Last updated" value={formatDate(company.lastUpdated)} />
            </dl>
          </Section>

          <Section title="In this sector">
            <ul className="space-y-2">
              {peers.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/company/${p.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[#F5F4EF]"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: STAGE_DOT[p.currentStage] }}
                    />
                    <span className="truncate font-normal text-ink">{p.name}</span>
                    <span className="ml-auto shrink-0">
                      <DealTypeBadge type={p.dealType} />
                    </span>
                  </Link>
                </li>
              ))}
              {peers.length === 0 && (
                <li className="text-[13px] text-subtle">No other companies in this sector.</li>
              )}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[14px] font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] font-normal text-subtle">{label}</dt>
      <dd className="text-right font-normal text-ink">{value}</dd>
    </div>
  );
}
