"use client";

// Thin client-side fetchers for the API routes. A 503 (mock mode / backend not
// configured) throws BackendOff so callers fall back to mock data.

import type { RadarCompany } from "@/lib/radar-data";
import type { FeedItemData } from "@/lib/adapters/feed";
import type {
  AlertRule as AlertRuleView,
  AlertPredicate as AlertPredicateView,
} from "@/lib/alert-rules";
import type { SavedView, SavedViewFilters } from "@/lib/saved-views";
import type {
  OurProcessStage,
  ProcessHistoryEntry,
  ProcessKeyDates,
} from "@/lib/process-stage";
import type { Contact, CompanyContact, ContactRole, FirmActivity } from "@/lib/contacts";

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
      pipelines: {
        pipeline: string;
        ranAt: string;
        records: number;
        errors: number;
        ok: boolean;
      }[];
    }>(`/api/admin/stats`),
  search: (q: string) =>
    jget<{
      found: number;
      hits: {
        document: {
          id: string;
          name: string;
          sector: string;
          dealType: string;
          currentStage: string;
          owner: string;
        };
      }[];
      source: string;
    }>(`/api/search?q=${encodeURIComponent(q)}`),
  setUserRole: (userId: string, role: string) =>
    jsend(`/api/admin/users`, "PATCH", { userId, role }),
  createUser: (body: { email: string; password: string; role: string; name?: string }) =>
    jsend<{ user: unknown }>(`/api/admin/users`, "POST", body),
  removeUser: (userId: string) =>
    jsend(`/api/admin/users?userId=${encodeURIComponent(userId)}`, "DELETE"),
  inviteUser: (body: { email: string; role?: string; name?: string }) =>
    jsend<{ ok: boolean; userId: string; emailed: boolean; actionLink?: string }>(
      `/api/admin/invite`,
      "POST",
      body
    ),
  getOrg: () => jget<{ org: OrgView | null }>(`/api/admin/org`),
  renameOrg: (name: string) =>
    jsend<{ ok: boolean; name: string }>(`/api/admin/org`, "PATCH", { name }),
  createOrg: (name: string) =>
    jsend<{ ok: boolean; org: { id: string; name: string } }>(`/api/orgs`, "POST", {
      name,
    }),
  generateScimToken: () =>
    jsend<{ token: string; scimBaseUrl: string }>(`/api/admin/scim-token`, "POST"),
  billingCheckout: (plan: "pro" | "enterprise") =>
    jsend<{ url: string | null }>(`/api/billing/checkout`, "POST", { plan }),
  billingPortal: () => jsend<{ url: string | null }>(`/api/billing/portal`, "POST"),
  deleteAccount: () => jsend<{ ok: boolean }>(`/api/account/delete`, "POST"),
  triggerPipeline: (name: string) => jsend(`/api/admin/trigger?pipeline=${name}`, "POST"),
  addWatch: (companyId: string) => jsend(`/api/watchlist`, "POST", { companyId }),
  removeWatch: (companyId: string) =>
    jsend(`/api/watchlist?companyId=${companyId}`, "DELETE"),
  addNote: (companyId: string, content: string) =>
    jsend<{ note: unknown }>(`/api/notes`, "POST", { companyId, content }),
  editNote: (id: string, content: string) =>
    jsend<{ note: unknown }>(`/api/notes/${id}`, "PATCH", { content }),
  deleteNote: (id: string) => jsend(`/api/notes/${id}`, "DELETE"),
  listAlerts: () => jget<{ rules: AlertRuleView[] }>(`/api/alerts`),
  createAlert: (body: {
    name: string;
    predicate: AlertPredicateView;
    webhook: boolean;
    emailDelivery?: boolean;
  }) => jsend<{ rule: AlertRuleView }>(`/api/alerts`, "POST", body),
  updateAlert: (id: string, body: { active?: boolean; name?: string }) =>
    jsend(`/api/alerts`, "PATCH", { id, ...body }),
  deleteAlert: (id: string) =>
    jsend(`/api/alerts?id=${encodeURIComponent(id)}`, "DELETE"),
  companyMemo: (companyId: string) =>
    jsend<{
      memo: string | null;
      configured: boolean;
      cached: boolean;
      generatedAt: string | null;
    }>(`/api/companies/${companyId}/memo`, "POST"),
  icMemo: (companyId: string) =>
    jsend<{
      sections: { title: string; body: string }[] | null;
      configured: boolean;
      cached: boolean;
      generatedAt: string | null;
    }>(`/api/companies/${companyId}/ic-memo`, "POST"),
  askCompany: (companyId: string, question: string) =>
    jsend<{
      answer: string | null;
      configured: boolean;
      citations: {
        signalId: string;
        quote: string;
        sourceType: string;
        sourceName: string | null;
        ingestedAt: string;
      }[];
    }>(`/api/companies/${companyId}/ask`, "POST", { question }),
  draftOutreachEmail: (companyId: string) =>
    jsend<{ draft: string | null; configured: boolean }>(
      `/api/companies/${companyId}/draft-outreach`,
      "POST"
    ),
  markReview: (companyId: string) =>
    jsend(`/api/companies/${companyId}`, "PATCH", { action: "mark_review" }),
  setStage: (companyId: string, stage: string) =>
    jsend(`/api/companies/${companyId}`, "PATCH", {
      action: "override",
      stage,
      notes: "Stage moved by analyst (drag).",
    }),
  setOutcome: (
    companyId: string,
    body: {
      outcome: "closed" | "withdrawn" | null;
      acquirer?: string | null;
      closeMultiple?: string | null;
      closedAt?: string | null;
    }
  ) =>
    jsend<{ ok: boolean }>(`/api/companies/${companyId}`, "PATCH", {
      action: "set_outcome",
      ...body,
    }),
  comps: (companyId: string) =>
    jget<{ comps: CompResultView[] }>(`/api/companies/${companyId}/comps`),
  apiKeys: () => jget<{ keys: ApiKeyView[] }>(`/api/admin/api-keys`),
  createApiKey: (name: string) =>
    jsend<{ key: ApiKeyView & { plaintext: string } }>(`/api/admin/api-keys`, "POST", {
      name,
    }),
  revokeApiKey: (id: string) => jsend(`/api/admin/api-keys?id=${id}`, "DELETE"),
  auditLog: (limit = 100) =>
    jget<{ entries: AuditEntryView[] }>(`/api/admin/audit?limit=${limit}`),
  notifications: () =>
    jget<{ notifications: NotificationView[]; unread: number }>(`/api/notifications`),
  markNotificationsRead: (id?: string) =>
    jsend(`/api/notifications/read`, "POST", id ? { id } : {}),
  adminFailures: () => jget<{ failures: FailureView[] }>(`/api/admin/failures`),
  replayFailure: (id: string) =>
    jsend<{ ok: boolean }>(`/api/admin/failures`, "POST", { id }),
  dismissFailure: (id: string) =>
    jsend(`/api/admin/failures?id=${encodeURIComponent(id)}`, "DELETE"),
  getPreferences: () =>
    jget<{
      briefingFrequency: "off" | "daily" | "weekly";
      reportFrequency: "off" | "weekly" | "monthly";
    }>(`/api/account/preferences`),
  setPreferences: (body: {
    briefingFrequency?: "off" | "daily" | "weekly";
    reportFrequency?: "off" | "weekly" | "monthly";
  }) => jsend<{ ok: boolean }>(`/api/account/preferences`, "PATCH", body),
  listTasks: (companyId: string) =>
    jget<{ tasks: import("@/lib/deal-tasks").DealTask[] }>(
      `/api/companies/${companyId}/tasks`
    ),
  createTask: (companyId: string, body: { title: string; dueAt?: string | null }) =>
    jsend<{ task: import("@/lib/deal-tasks").DealTask }>(
      `/api/companies/${companyId}/tasks`,
      "POST",
      body
    ),
  completeTask: (companyId: string, taskId: string, completed: boolean) =>
    jsend<{ task: import("@/lib/deal-tasks").DealTask }>(
      `/api/companies/${companyId}/tasks?taskId=${encodeURIComponent(taskId)}`,
      "PATCH",
      { completed }
    ),
  deleteTask: (companyId: string, taskId: string) =>
    jsend<{ ok: boolean }>(
      `/api/companies/${companyId}/tasks?taskId=${encodeURIComponent(taskId)}`,
      "DELETE"
    ),
  listOutreach: (companyId: string) =>
    jget<{ entries: import("@/lib/deal-tasks").OutreachEntry[] }>(
      `/api/companies/${companyId}/outreach`
    ),
  logOutreach: (
    companyId: string,
    body: {
      type: "call" | "email" | "meeting" | "other";
      note: string;
      contactedAt?: string;
    }
  ) =>
    jsend<{ entry: import("@/lib/deal-tasks").OutreachEntry }>(
      `/api/companies/${companyId}/outreach`,
      "POST",
      body
    ),
  deleteOutreach: (companyId: string, entryId: string) =>
    jsend<{ ok: boolean }>(
      `/api/companies/${companyId}/outreach?entryId=${encodeURIComponent(entryId)}`,
      "DELETE"
    ),
  assignOwner: (companyId: string, ownerId: string | null) =>
    jsend<{ ok: boolean }>(`/api/companies/${companyId}`, "PATCH", {
      action: "assign_owner",
      ownerId,
    }),
  suggestions: () =>
    jget<{
      suggestions: {
        id: string;
        name: string;
        sector: string;
        dealType: string;
        stage: string;
        score: number;
        matchReasons: string[];
      }[];
    }>(`/api/radar/suggestions`),
  listSavedViews: () => jget<{ views: SavedView[] }>(`/api/saved-views`),
  createSavedView: (body: { name: string; filters: SavedViewFilters }) =>
    jsend<{ view: SavedView }>(`/api/saved-views`, "POST", body),
  deleteSavedView: (id: string) =>
    jsend<{ ok: boolean }>(`/api/saved-views?id=${encodeURIComponent(id)}`, "DELETE"),
  getOrgMembers: () =>
    jget<{ members: { id: string; name: string; handle: string }[] }>(
      `/api/orgs/members`
    ),
  getProcessStage: (id: string) =>
    jget<{
      stage: OurProcessStage | null;
      keyDates: ProcessKeyDates;
      history: ProcessHistoryEntry[];
    }>(`/api/companies/${id}/process-stage`),
  setProcessStage: (
    id: string,
    body: { stage: OurProcessStage | null; notes?: string }
  ) =>
    jsend<{ stage: OurProcessStage | null }>(
      `/api/companies/${id}/process-stage`,
      "PATCH",
      body
    ),
  updateProcessKeyDate: (id: string, body: { stage: string; date: string | null }) =>
    jsend<{ keyDates: ProcessKeyDates }>(
      `/api/companies/${id}/process-stage/key-dates`,
      "PATCH",
      body
    ),
  // ---- contacts ----
  listContacts: (qs = "") => jget<{ contacts: Contact[] }>(`/api/contacts${qs}`),
  createContact: (body: Partial<Contact> & { name: string }) =>
    jsend<{ contact: Contact }>(`/api/contacts`, "POST", body),
  updateContact: (id: string, body: Partial<Contact>) =>
    jsend<{ contact: Contact }>(`/api/contacts/${id}`, "PATCH", body),
  deleteContact: (id: string) => jsend<{ ok: boolean }>(`/api/contacts/${id}`, "DELETE"),
  companyContacts: (companyId: string) =>
    jget<{ contacts: CompanyContact[]; suggestions: string[] }>(
      `/api/companies/${companyId}/contacts`
    ),
  addCompanyContact: (
    companyId: string,
    body:
      | { contactId: string; role: ContactRole }
      | (Partial<Contact> & { name: string; role: ContactRole })
  ) =>
    jsend<{ contact: CompanyContact }>(
      `/api/companies/${companyId}/contacts`,
      "POST",
      body
    ),
  removeCompanyContact: (companyId: string, linkId: string) =>
    jsend<{ ok: boolean }>(
      `/api/companies/${companyId}/contacts?linkId=${encodeURIComponent(linkId)}`,
      "DELETE"
    ),
  firmActivity: () => jget<{ firms: FirmActivity[] }>(`/api/contacts/firms`),
};

export type { SavedView, SavedViewFilters };

export interface CompResultView {
  id: string;
  name: string;
  sector: string;
  dealType: string;
  stage: string;
  revenue?: string | null;
  ebitda?: string | null;
  outcome?: string | null;
  score: number;
  matchReasons: string[];
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface FailureView {
  id: string;
  sourceType: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  reason: string | null;
  excerpt: string;
  createdAt: string;
}

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}
export interface OrgView {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  plan: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  seatsUsed: number;
  seatLimit: number | null;
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
