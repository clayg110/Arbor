"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLive } from "@/lib/use-live";
import { api } from "@/lib/api-client";
import { radarCompanies, type RadarCompany } from "@/lib/radar-data";
import { buildDealRoom, type DealRoomInput } from "@/lib/deal-room";
import {
  AttentionPill,
  ProcessStageBadge,
  NextAction,
  nextActionTiming,
} from "@/components/ui/DealRoom";
import { ConvictionBadge } from "@/components/ui/ConvictionBadge";
import { DealTypeBadge } from "@/components/ui/DealTypeBadge";
import { SectorBadge } from "@/components/ui/SectorBadge";
import { StageBadge } from "@/components/ui/StageBadge";
import { SignalSourceBadge } from "@/components/ui/SignalSourceBadge";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { CONVICTION_LABEL } from "@/lib/conviction";
import { MARKET_TIMING_LABEL } from "@/lib/predict-market";
import { probabilityToClose, basisLabel } from "@/lib/calibration";
import { checklistForStage } from "@/lib/task-templates";
import { formatDate } from "@/lib/format";

function toInput(c: RadarCompany): DealRoomInput {
  return {
    companyId: c.companyId ?? c.id,
    name: c.name,
    dealType: c.dealType,
    sector: c.sector,
    ownerName: c.ownerName,
    marketStage: c.stage,
    processStage: c.ourProcessStage ?? null,
    keyDates: c.processKeyDates ?? null,
    conviction: c.conviction,
    marketTiming: c.marketTiming,
    lastSignalDaysAgo: c.lastSignal.daysAgo,
  };
}

export default function DealRoomPage() {
  const params = useParams();
  const id = String(params.id);

  const live = useLive(
    "deals",
    () => api.companies("?limit=500"),
    {
      companies: radarCompanies,
      total: radarCompanies.length,
      summary: null,
      sectorSummary: [],
    },
    { realtime: true }
  );

  const company = useMemo(
    () => live.data.companies.find((c) => (c.companyId ?? c.id) === id),
    [live.data.companies, id]
  );

  const backLink = (
    <Link
      href="/deals"
      className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-normal text-muted hover:text-ink"
    >
      <ArrowLeftIcon className="h-4 w-4" /> Back to deal rooms
    </Link>
  );

  if (!company) {
    return (
      <div>
        {backLink}
        <div
          className="rounded-lg bg-surface py-16 text-center"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <p className="text-[14px] font-medium text-ink">Deal room not found</p>
          <p className="mt-1 text-[13px] text-muted">
            This company has no active process, or it isn&apos;t on your radar.
          </p>
        </div>
      </div>
    );
  }

  const room = buildDealRoom(toInput(company));
  const hasProfile = !!company.companyId;
  const closeProb = probabilityToClose(room.conviction?.score ?? 0);

  return (
    <div>
      {backLink}

      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-medium leading-tight text-ink">
              {room.name}
            </h1>
            <AttentionPill level={room.attention} />
          </div>
          <p className="mt-2 text-[12px] font-normal text-muted">
            {room.dealType === "carveout" ? "Parent" : "Sponsor"}: {room.ownerName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <DealTypeBadge type={room.dealType} />
            <SectorBadge sector={room.sector} />
            <StageBadge stage={room.marketStage} />
            {room.processStage && <ProcessStageBadge stage={room.processStage} />}
          </div>
        </div>
        {hasProfile && (
          <Link
            href={`/company/${company.companyId}`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-[#185FA5] hover:bg-[#E6F1FB]"
            style={{ border: "0.5px solid var(--border)" }}
          >
            Open full profile →
          </Link>
        )}
      </div>

      {/* attention banner */}
      {room.nextAction && (
        <div
          className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-4 py-3"
          style={{
            border: "0.5px solid var(--border)",
            backgroundColor: room.nextAction.overdue ? "#FBECEB" : "var(--surface)",
          }}
        >
          <span className="text-[12px] font-medium text-subtle">Next action</span>
          <NextAction nextAction={room.nextAction} />
        </div>
      )}

      {/* layer cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* process */}
        <Card title="Process & key dates">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-normal text-ink">
              {room.processStageLabel ?? "No process stage set"}
            </span>
            <span className="text-[11px] font-normal text-subtle">
              {Math.round(room.processProgress * 100)}% through pipeline
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E6E4DD]">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.round(room.processProgress * 100)}%`,
                backgroundColor: "#185FA5",
              }}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {room.keyDates.length === 0 && (
              <li className="text-[12px] text-subtle">No key dates scheduled.</li>
            )}
            {room.keyDates.map((d) => (
              <li
                key={d.stage}
                className="flex items-center justify-between gap-3 text-[12px]"
              >
                <span className="font-normal text-ink">{d.label}</span>
                <span className="flex items-center gap-2 text-muted">
                  {formatDate(d.date)}
                  <span
                    className="font-medium"
                    style={{ color: d.daysUntil < 0 ? "#9A2622" : "var(--text-subtle)" }}
                  >
                    {nextActionTiming({
                      label: d.label,
                      date: d.date,
                      daysUntil: d.daysUntil,
                      overdue: d.daysUntil < 0,
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* intelligence */}
        <Card title="Conviction & timing">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-normal text-subtle">Conviction</span>
            {room.conviction ? (
              <span className="flex items-center gap-2">
                <ConvictionBadge
                  score={room.conviction.score}
                  band={room.conviction.band}
                />
                <span className="text-[12px] text-muted">
                  {CONVICTION_LABEL[room.conviction.band]}
                </span>
              </span>
            ) : (
              <span className="text-[12px] text-subtle">—</span>
            )}
          </div>
          {room.conviction && (
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-normal text-subtle">
                Probability to close
                <span className="ml-1.5 text-[11px] text-subtle">
                  ({basisLabel(closeProb)})
                </span>
              </span>
              <span className="text-[15px] font-medium text-ink">≈ {closeProb.pct}%</span>
            </div>
          )}
          {room.marketTiming && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-normal text-subtle">
                  Coming to market
                </span>
                <span className="text-[12px] font-medium text-ink">
                  {MARKET_TIMING_LABEL[room.marketTiming.band]} ·{" "}
                  {room.marketTiming.horizon}
                </span>
              </div>
              {room.marketTiming.drivers.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {room.marketTiming.drivers.map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-1.5 text-[12px] text-muted"
                    >
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: "#157A5A" }}
                        aria-hidden
                      />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        {/* signal */}
        <Card title="Latest signal">
          <div className="flex items-center gap-2 text-[13px] font-normal text-ink">
            <SignalSourceBadge source={company.lastSignal.source} />
            <span>{company.lastSignal.sourceName}</span>
            <span className="text-muted">· {company.lastSignal.label}</span>
          </div>
          {company.quote && (
            <blockquote
              className="mt-3 rounded-r px-3 py-2 text-[12px] font-normal italic text-muted"
              style={{ backgroundColor: "#F5F4EF", borderLeft: "2px solid #185FA5" }}
            >
              “{company.quote}”
            </blockquote>
          )}
          {room.stale && (
            <p className="mt-3 text-[12px] font-medium" style={{ color: "#633806" }}>
              No new signal in 30+ days — worth a manual review.
            </p>
          )}
        </Card>

        {/* relationship / jump-to */}
        <Card title="Work the deal">
          <p className="text-[12px] font-normal text-muted">
            Bids, advisor contacts, analyst notes and the IC memo live on the full company
            profile.
          </p>
          {hasProfile ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <ProfileLink href={`/company/${company.companyId}`} label="Open profile" />
              <ProfileLink href={`/company/${company.companyId}`} label="Bids & offers" />
              <ProfileLink href={`/company/${company.companyId}`} label="Contacts" />
              <ProfileLink href={`/company/${company.companyId}`} label="IC memo" />
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-subtle">
              No detailed profile is linked for this company yet.
            </p>
          )}
        </Card>

        {/* stage playbook */}
        {room.processStage && checklistForStage(room.processStage).length > 0 && (
          <Card title={`Playbook — ${room.processStageLabel}`}>
            <p className="mb-2 text-[12px] font-normal text-muted">
              The standard next steps at this stage. Add them as dated tasks from the
              company&apos;s Tasks section.
            </p>
            <ul className="space-y-1.5">
              {checklistForStage(room.processStage).map((item) => (
                <li
                  key={item.title}
                  className="flex items-center justify-between gap-3 text-[12px]"
                >
                  <span className="text-ink">{item.title}</span>
                  <span className="shrink-0 text-[11px] text-subtle">
                    +{item.dueOffsetDays}d
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-lg bg-surface p-4"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <h2 className="mb-3 text-[14px] font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function ProfileLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[#185FA5] hover:bg-[#E6F1FB]"
      style={{ border: "0.5px solid var(--border)" }}
    >
      {label} →
    </Link>
  );
}
