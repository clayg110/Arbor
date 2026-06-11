-- 0039_deal_bids.sql
-- Bid / offer tracker: record bids per company per process round.

CREATE TYPE bid_type_enum AS ENUM ('indicative', 'final');
CREATE TYPE bid_round_enum AS ENUM ('1', '2', 'final');

CREATE TABLE deal_bids (
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

CREATE INDEX deal_bids_company_idx ON deal_bids(company_id);
CREATE INDEX deal_bids_org_idx     ON deal_bids(org_id) WHERE org_id IS NOT NULL;

ALTER TABLE deal_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view bids" ON deal_bids
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY "users insert own bids" ON deal_bids
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own bids" ON deal_bids
  FOR DELETE TO authenticated USING (user_id = auth.uid());
