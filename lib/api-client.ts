"use client";

// Thin client-side fetchers for the API routes. A 503 (mock mode / backend not
// configured) throws BackendOff so callers fall back to mock data.

import type { RadarCompany } from "@/lib/radar-data";
import type { FeedItemData } from "@/lib/adapters/feed";

export class BackendOff extends Error {
  constructor() {
    super("backend-off");
    this.name = "BackendOff";
  }
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 503) throw new BackendOff();
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

async function jsend<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 503) throw new BackendOff();
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

// ---- payload shapes (match the route returns) ----
export interface SummaryStripData {
  total: number;
  inMarket: number;
  monitor: number;
  onHold: number;
  needsReview: number;
  newThisWeek: number;
  newCarveout: number;
  newPrivate: number;
}
export interface SectorSummaryData {
  key: string;
  label: string;
  total: number;
  inMarket: number;
  monitor: number;
  onHold: number;
}
export interface CompaniesResponse {
  companies: RadarCompany[];
  total: number;
  summary: SummaryStripData | null;
  sectorSummary: SectorSummaryData[];
}
export interface FeedResponse {
  items: FeedItemData[];
}
export interface RangeStats {
  stageChanges: number;
  newEntries: number;
  pulled: number;
  flagged: number;
  confidence: number;
}
export interface StatsResponse {
  summary: SummaryStripData | null;
  sectorSummary: SectorSummaryData[];
  rangeStats: RangeStats | null;
}

// ---- fetchers ----
export const api = {
  companies: (qs = "") => jget<CompaniesResponse>(`/api/companies${qs}`),
  createCompany: (body: Record<string, unknown>) =>
    jsend<{ company: RadarCompany }>(`/api/companies`, "POST", body),
  watchlist: () => jget<{ ids: string[]; companies: RadarCompany[] }>(`/api/watchlist`),
  feed: (qs = "") => jget<FeedResponse>(`/api/feed${qs}`),
  analytics: (qs = "") => jget<Record<string, unknown>>(`/api/analytics${qs}`),
  stats: (qs = "") => jget<StatsResponse>(`/api/stats/summary${qs}`),
  review: () => jget<{ rows: unknown[] }>(`/api/review`),
  reviewAction: (id: string, body: unknown) => jsend(`/api/review/${id}`, "POST", body),
  adminUsers: () => jget<{ users: unknown[] }>(`/api/admin/users`),
  adminStats: () =>
    jget<{
      stats: {
        totalCompanies: number;
        signalsThisWeek: number;
        llmCallsThisWeek: number;
        avgConfidence: number | null;
      };
      pipelines: { pipeline: string; ranAt: string; records: number; errors: number; ok: boolean }[];
    }>(`/api/admin/stats`),
  search: (q: string) =>
    jget<{
      found: number;
      hits: { document: { id: string; name: string; sector: string; dealType: string; currentStage: string; owner: string } }[];
      source: string;
    }>(`/api/search?q=${encodeURIComponent(q)}`),
  setUserRole: (userId: string, role: string) =>
    jsend(`/api/admin/users`, "PATCH", { userId, role }),
  createUser: (body: { email: string; password: string; role: string; name?: string }) =>
    jsend<{ user: unknown }>(`/api/admin/users`, "POST", body),
  triggerPipeline: (name: string) => jsend(`/api/admin/trigger?pipeline=${name}`, "POST"),
  addWatch: (companyId: string) => jsend(`/api/watchlist`, "POST", { companyId }),
  removeWatch: (companyId: string) =>
    jsend(`/api/watchlist?companyId=${companyId}`, "DELETE"),
  addNote: (companyId: string, content: string) =>
    jsend<{ note: unknown }>(`/api/notes`, "POST", { companyId, content }),
  editNote: (id: string, content: string) =>
    jsend<{ note: unknown }>(`/api/notes/${id}`, "PATCH", { content }),
  deleteNote: (id: string) => jsend(`/api/notes/${id}`, "DELETE"),
  markReview: (companyId: string) =>
    jsend(`/api/companies/${companyId}`, "PATCH", { action: "mark_review" }),
  setStage: (companyId: string, stage: string) =>
    jsend(`/api/companies/${companyId}`, "PATCH", {
      action: "override",
      stage,
      notes: "Stage moved by analyst (drag).",
    }),
  apiKeys: () => jget<{ keys: ApiKeyView[] }>(`/api/admin/api-keys`),
  createApiKey: (name: string) =>
    jsend<{ key: ApiKeyView & { plaintext: string } }>(`/api/admin/api-keys`, "POST", { name }),
  revokeApiKey: (id: string) => jsend(`/api/admin/api-keys?id=${id}`, "DELETE"),
  auditLog: (limit = 100) => jget<{ entries: AuditEntryView[] }>(`/api/admin/audit?limit=${limit}`),
};

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}
export interface AuditEntryView {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
