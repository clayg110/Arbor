-- GENERATED — do not edit. Concatenation of migrations 0035–0045 in order.
-- Source of truth = supabase/migrations/NNNN_*.sql. Regenerate, never hand-edit.
-- Paste into the Supabase SQL editor once, for first go-live, then run in order.
-- 0035–0041 were made idempotent (CI 51f988b) so re-running is safe; 0042–0045 are
-- first-apply DDL — run on a schema that does not yet have them.

-- ============================================================
-- 0035_deal_process_stage.sql
-- ============================================================
-- 0035_deal_process_stage.sql
-- Internal deal process tracking: our_process_stage on companies,
-- process history log, and per-stage key dates.
-- Idempotent: safe to re-apply against a DB where objects already exist
-- (e.g. a prod clone seeded outside migration tracking).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'our_process_stage_enum') THEN
    CREATE TYPE our_process_stage_enum AS ENUM (
      'watching',
      'teaser_received',
      'nda_signed',
      'cim_received',
      'first_round_bid',
      'management_presentation',
      'second_round_bid',
      'exclusivity',
      'loi_signed',
      'due_diligence',
      'won',
      'passed'
    );
  END IF;
END $$;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS our_process_stage our_process_stage_enum NULL,
  ADD COLUMN IF NOT EXISTS process_key_dates jsonb NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS companies_our_process_stage_idx ON companies(our_process_stage)
  WHERE our_process_stage IS NOT NULL;

-- History: every stage change stamped with date + author.
CREATE TABLE IF NOT EXISTS deal_process_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       uuid NULL,
  stage        our_process_stage_enum NOT NULL,
  notes        text NULL CHECK (char_length(notes) <= 500),
  changed_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_process_history_company_idx ON deal_process_history(company_id);

ALTER TABLE deal_process_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view process history" ON deal_process_history;
CREATE POLICY "org members view process history" ON deal_process_history
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "users insert own process history" ON deal_process_history;
CREATE POLICY "users insert own process history" ON deal_process_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own process history" ON deal_process_history;
CREATE POLICY "users delete own process history" ON deal_process_history
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ============================================================
-- 0036_contacts.sql
-- ============================================================
-- 0036_contacts.sql
-- Contact / banker relationship layer: a structured directory of people
-- (advisors, executives, counsel) the team knows. Org-scoped.
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NULL,
  created_by   uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  title        text NULL CHECK (title IS NULL OR char_length(title) <= 200),
  firm         text NULL CHECK (firm IS NULL OR char_length(firm) <= 200),
  email        text NULL CHECK (email IS NULL OR char_length(email) <= 320),
  phone        text NULL CHECK (phone IS NULL OR char_length(phone) <= 50),
  linkedin_url text NULL CHECK (linkedin_url IS NULL OR char_length(linkedin_url) <= 500),
  notes        text NULL CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_org_idx ON contacts(org_id);
CREATE INDEX IF NOT EXISTS contacts_firm_idx ON contacts(firm);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Org-scoped: members see and manage contacts for their org. Contacts created
-- without an org (solo / pre-org) are visible to their creator.
DROP POLICY IF EXISTS "org members view contacts" ON contacts;
CREATE POLICY "org members view contacts" ON contacts FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert contacts" ON contacts;
CREATE POLICY "members insert contacts" ON contacts FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      org_id IS NULL
      OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

DROP POLICY IF EXISTS "members update org contacts" ON contacts;
CREATE POLICY "members update org contacts" ON contacts FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members delete org contacts" ON contacts;
CREATE POLICY "members delete org contacts" ON contacts FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );


-- ============================================================
-- 0037_company_contacts.sql
-- ============================================================
-- 0037_company_contacts.sql
-- Join table linking contacts to companies with a per-link role
-- (a banker can be M&A Advisor on one deal, an exec elsewhere).
-- Idempotent: safe to re-apply.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_role_enum') THEN
    CREATE TYPE contact_role_enum AS ENUM (
      'M&A Advisor',
      'CFO',
      'CEO',
      'Partner',
      'Counsel',
      'Other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS company_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  org_id      uuid NULL,
  role        contact_role_enum NOT NULL DEFAULT 'Other',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, contact_id)
);

CREATE INDEX IF NOT EXISTS company_contacts_company_idx ON company_contacts(company_id);
CREATE INDEX IF NOT EXISTS company_contacts_contact_idx ON company_contacts(contact_id);

ALTER TABLE company_contacts ENABLE ROW LEVEL SECURITY;

-- Visible to org members; companies are global so visibility follows the org of
-- the link (NULL org = creator-only via the contact's own RLS on join reads).
DROP POLICY IF EXISTS "org members view company_contacts" ON company_contacts;
CREATE POLICY "org members view company_contacts" ON company_contacts
  FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert company_contacts" ON company_contacts;
CREATE POLICY "members insert company_contacts" ON company_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members update company_contacts" ON company_contacts;
CREATE POLICY "members update company_contacts" ON company_contacts
  FOR UPDATE TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members delete company_contacts" ON company_contacts;
CREATE POLICY "members delete company_contacts" ON company_contacts
  FOR DELETE TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );


-- ============================================================
-- 0038_company_ic_memos.sql
-- ============================================================
-- 0038_company_ic_memos.sql
-- Cache for the structured IC memo (distinct from the free-form company_memos).
-- One row per company; regenerated when the signal/process/comps fingerprint
-- changes. Service-role writes only (mirrors company_memos); readable to
-- authenticated users. Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS company_ic_memos (
  company_id   uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  memo         text NOT NULL,
  signals_hash text NOT NULL,
  model        text NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_ic_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ic_memos_read" ON company_ic_memos;
CREATE POLICY "ic_memos_read" ON company_ic_memos
  FOR SELECT TO authenticated USING (true);


-- ============================================================
-- 0039_deal_bids.sql
-- ============================================================
-- 0039_deal_bids.sql
-- Bid / offer tracker: record bids per company per process round.
-- Idempotent: safe to re-apply.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_type_enum') THEN
    CREATE TYPE bid_type_enum AS ENUM ('indicative', 'final');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_round_enum') THEN
    CREATE TYPE bid_round_enum AS ENUM ('1', '2', 'final');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS deal_bids (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id              uuid NULL,
  bid_type            bid_type_enum NOT NULL,
  round               bid_round_enum NOT NULL DEFAULT '1',
  bid_date            date NOT NULL,
  amount_usd          numeric(18, 2) NULL,   -- in millions USD
  multiple_on_ebitda  numeric(6, 2) NULL,
  rationale           text NULL CHECK (char_length(rationale) <= 1000),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_bids_company_idx ON deal_bids(company_id);
CREATE INDEX IF NOT EXISTS deal_bids_org_idx     ON deal_bids(org_id) WHERE org_id IS NOT NULL;

ALTER TABLE deal_bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view bids" ON deal_bids;
CREATE POLICY "org members view bids" ON deal_bids
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "users insert own bids" ON deal_bids;
CREATE POLICY "users insert own bids" ON deal_bids
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own bids" ON deal_bids;
CREATE POLICY "users delete own bids" ON deal_bids
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ============================================================
-- 0040_funds.sql
-- ============================================================
-- 0040_funds.sql
-- Fund layer for LP / fund-level reporting. A fund is an org-scoped investment
-- vehicle with a vintage year; deals (companies) can be assigned to one fund.
-- The LP report aggregates the pipeline by fund (vintage) × sector for a chosen
-- quarter. Org-scoped RLS mirrors contacts (0036). Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS funds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NULL,
  created_by   uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  vintage_year int NULL CHECK (vintage_year IS NULL OR (vintage_year BETWEEN 1900 AND 2200)),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funds_org_idx ON funds(org_id);

ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view funds" ON funds;
CREATE POLICY "org members view funds" ON funds FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert funds" ON funds;
CREATE POLICY "members insert funds" ON funds FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      org_id IS NULL
      OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

DROP POLICY IF EXISTS "members update org funds" ON funds;
CREATE POLICY "members update org funds" ON funds FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members delete org funds" ON funds;
CREATE POLICY "members delete org funds" ON funds FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Assign a deal to a fund. ON DELETE SET NULL so deleting a fund unassigns its
-- deals rather than removing them from the pipeline.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fund_id uuid NULL REFERENCES funds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS companies_fund_idx ON companies(fund_id);


-- ============================================================
-- 0041_crm_sync.sql
-- ============================================================
-- 0041_crm_sync.sql
-- CRM sync state: one current row per (company, provider) recording the last
-- push to an external CRM (Affinity, etc.). One-way export for now. Org-scoped
-- RLS mirrors contacts (0036). Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS crm_sync (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  org_id       uuid NULL,
  created_by   uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  provider     text NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 50),
  external_id  text NULL CHECK (external_id IS NULL OR char_length(external_id) <= 200),
  status       text NOT NULL CHECK (status IN ('synced', 'error')),
  error        text NULL CHECK (error IS NULL OR char_length(error) <= 500),
  synced_at    timestamptz NOT NULL DEFAULT now()
);

-- One current sync row per company+provider; re-syncing upserts it.
CREATE UNIQUE INDEX IF NOT EXISTS crm_sync_company_provider_idx ON crm_sync(company_id, provider);
CREATE INDEX IF NOT EXISTS crm_sync_org_idx ON crm_sync(org_id);

ALTER TABLE crm_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view crm_sync" ON crm_sync;
CREATE POLICY "org members view crm_sync" ON crm_sync FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert crm_sync" ON crm_sync;
CREATE POLICY "members insert crm_sync" ON crm_sync FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      org_id IS NULL
      OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

DROP POLICY IF EXISTS "members update org crm_sync" ON crm_sync;
CREATE POLICY "members update org crm_sync" ON crm_sync FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members delete org crm_sync" ON crm_sync;
CREATE POLICY "members delete org crm_sync" ON crm_sync FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );


-- ============================================================
-- 0042_feature_flags.sql
-- ============================================================
-- 0042_feature_flags.sql
-- Kill switches / feature flags. A row turns a feature OFF (enabled=false);
-- absent table or row means the feature is ON, so code stays dormant-safe before
-- this migration is applied. Optional org_id scopes a flag to one tenant; a NULL
-- org_id row is the global default. Resolution (org override beats global) lives
-- in lib/flags.ts so it's pure + unit-tested.

-- Surrogate PK: org_id must stay NULLABLE (a NULL row is the global default), so
-- it can't be part of a primary key. Uniqueness is enforced by the two partial
-- indexes below instead.
CREATE TABLE feature_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL CHECK (char_length(key) BETWEEN 1 AND 100),
  org_id      uuid NULL,
  enabled     boolean NOT NULL DEFAULT true,
  description text NULL CHECK (description IS NULL OR char_length(description) <= 500),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- At most one global row per key (plain UNIQUE wouldn't dedupe NULL org_ids).
CREATE UNIQUE INDEX feature_flags_global_idx
  ON feature_flags (key)
  WHERE org_id IS NULL;

-- At most one row per (key, org).
CREATE UNIQUE INDEX feature_flags_org_idx
  ON feature_flags (key, org_id)
  WHERE org_id IS NOT NULL;

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user (so the app can reflect flag state); writes
-- go through the service client (admin tooling), which bypasses RLS.
CREATE POLICY "authenticated read feature_flags" ON feature_flags FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );


-- ============================================================
-- 0043_company_search_trgm.sql
-- ============================================================
-- 0043_company_search_trgm.sql
-- Trigram indexes for the radar text search. /api/companies filters with
-- `name/sponsor_firm/parent_company ILIKE %q%`, which can't use a btree index and
-- sequentially scans as the table grows. pg_trgm GIN indexes make those
-- substring matches index-backed. No code change — the existing ILIKE queries
-- use these automatically.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS companies_name_trgm_idx
  ON companies USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS companies_sponsor_firm_trgm_idx
  ON companies USING gin (sponsor_firm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS companies_parent_company_trgm_idx
  ON companies USING gin (parent_company gin_trgm_ops);


-- ============================================================
-- 0044_documents.sql
-- ============================================================
-- 0044_documents.sql
-- Deal document attachments: teasers / CIMs / financials uploaded per company.
-- The binary lives in Supabase Storage (bucket: deal-documents); this row holds
-- the metadata + any auto-extracted financials. Org-scoped RLS mirrors contacts
-- (0036). Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  org_id        uuid NULL,
  created_by    uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
  kind          text NOT NULL CHECK (kind IN ('teaser', 'cim', 'financials', 'other')),
  storage_path  text NULL CHECK (storage_path IS NULL OR char_length(storage_path) <= 500),
  content_type  text NULL CHECK (content_type IS NULL OR char_length(content_type) <= 120),
  size_bytes    bigint NULL,
  extracted     jsonb NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_company_idx ON documents(company_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view documents" ON documents;
CREATE POLICY "org members view documents" ON documents FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert documents" ON documents;
CREATE POLICY "members insert documents" ON documents FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      org_id IS NULL
      OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

DROP POLICY IF EXISTS "members delete org documents" ON documents;
CREATE POLICY "members delete org documents" ON documents FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );


-- ============================================================
-- 0045_signal_feedback.sql
-- ============================================================
-- 0045_signal_feedback.sql
-- Analyst feedback loop: one up/down vote per (signal, user) on whether the
-- extractor got a signal right. Aggregated feedback nudges confidence and is the
-- training data for tuning extraction. Org-scoped RLS. Idempotent.

CREATE TABLE IF NOT EXISTS signal_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id   uuid NOT NULL REFERENCES signals_raw(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NULL,
  vote        text NOT NULL CHECK (vote IN ('up', 'down')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_id, user_id)
);

CREATE INDEX IF NOT EXISTS signal_feedback_signal_idx ON signal_feedback(signal_id);

ALTER TABLE signal_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view signal_feedback" ON signal_feedback;
CREATE POLICY "org members view signal_feedback" ON signal_feedback
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "users upsert own signal_feedback" ON signal_feedback;
CREATE POLICY "users upsert own signal_feedback" ON signal_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own signal_feedback" ON signal_feedback;
CREATE POLICY "users update own signal_feedback" ON signal_feedback
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own signal_feedback" ON signal_feedback;
CREATE POLICY "users delete own signal_feedback" ON signal_feedback
  FOR DELETE TO authenticated USING (user_id = auth.uid());

