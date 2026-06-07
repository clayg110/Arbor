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
} from "@/lib/mock-data";
import {
  SECTOR_LABELS,
  DEAL_TYPE_LABELS,
  CONFIDENCE_LABELS,
  STAGE_LABELS,
  STAGE_DOT,
} from "@/lib/colors";
import { formatDate, daysLabel } from "@/lib/format";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import {
  toCompanyProfile,
  toStageHistory,
  toSignals,
  toNotes,
} from "@/lib/adapters";
import type { DbCompany, DbHistory, DbSignal, DbNote } from "@/types/db";
import type { Company, StageHistoryRecord, Signal, Note } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let company: Company | undefined;
  let history: StageHistoryRecord[] = [];
  let signals: Signal[] = [];
  let notes: Note[] = [];
  let peers: Company[] = [];
  let currentUserId: string | undefined;

  if (hasSupabaseEnv()) {
    try {
      const sb = await createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      currentUserId = user?.id;
      const { data: c } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
      if (c) {
        const cc = c as DbCompany;
        const [{ data: h }, { data: s }, { data: n }, { data: p }] = await Promise.all([
          sb.from("deal_stage_history").select("*").eq("company_id", cc.id).order("changed_at", { ascending: false }),
          sb.from("signals_raw").select("*").eq("company_id", cc.id).order("ingested_at", { ascending: false }).limit(8),
          sb.from("analyst_notes").select("*").eq("company_id", cc.id).order("created_at", { ascending: false }),
          sb.from("companies").select("*").eq("sector", cc.sector).neq("id", cc.id).limit(4),
        ]);
        company = toCompanyProfile(cc);
        history = toStageHistory((h ?? []) as DbHistory[]);
        signals = toSignals((s ?? []) as DbSignal[]);
        notes = toNotes((n ?? []) as DbNote[]);
        peers = ((p ?? []) as DbCompany[]).map(toCompanyProfile);
      }
    } catch {
      company = undefined;
    }
  }

  if (!company) {
    const c = getCompany(id);
    if (c) {
      company = c;
      history = getStageHistory(c.id);
      signals = getSignals(c.id);
      notes = getNotes(c.id);
      peers = getSectorPeers(c.id);
    }
  }

  if (!company) notFound();

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
          <div className="flex items-center gap-3">
            <CompanyLogo name={company.name} url={company.logoUrl} />
            <h1 className="text-[22px] font-medium leading-tight text-ink">
              {company.name}
            </h1>
          </div>
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
          <MarkReviewButton
            companyId={company.id}
            flagged={company.confidence === "needs_review"}
          />
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
            <AnalystNoteEditor initialNotes={notes} companyId={company.id} currentUserId={currentUserId} />
          </Section>
        </div>

        {/* right */}
        <div className="space-y-6">
          <Section title="Company details">
            <dl className="space-y-2.5 text-[13px]">
              <Detail label="Sector" value={SECTOR_LABELS[company.sector] ?? company.sector} />
              {company.subsector && <Detail label="Subsector" value={company.subsector} />}
              <Detail label="Deal type" value={DEAL_TYPE_LABELS[company.dealType]} />
              <Detail
                label={company.dealType === "carveout" ? "Parent (owner)" : "Sponsor (owner)"}
                value={company.parentCompany ?? company.sponsorFirm ?? "—"}
              />
              <Detail label="Current stage" value={STAGE_LABELS[company.currentStage]} />
              <Detail label="Confidence" value={CONFIDENCE_LABELS[company.confidence]} />
              {company.revenue && (
                <FinDetail label="Revenue" value={company.revenue} href={company.revenueSource} />
              )}
              {company.ebitda && (
                <FinDetail label="EBITDA" value={company.ebitda} href={company.ebitdaSource} />
              )}
              {company.margin && <Detail label="Margin" value={company.margin} />}
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

// Financial figure whose value links to its source filing / press release.
function FinDetail({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] font-normal text-subtle">{label}</dt>
      <dd className="text-right font-normal text-ink">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-[#185FA5] hover:underline">
            {value} ↗
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function CompanyLogo({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-md object-contain"
        style={{ border: "0.5px solid var(--border)" }}
      />
    );
  }
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "—";
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#F1EFE8] text-[13px] font-medium text-[#444441]"
      style={{ border: "0.5px solid var(--border)" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
