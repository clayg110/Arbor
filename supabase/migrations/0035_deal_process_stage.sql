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
