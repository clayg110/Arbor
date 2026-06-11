-- Add deal outcome fields to companies.
-- outcome: closed (deal transacted) | withdrawn (process abandoned).
-- These feed comparable-deal scoring and confidence calibration (0027).

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS outcome        text   CHECK (outcome IN ('closed', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS acquirer       text,
  ADD COLUMN IF NOT EXISTS close_multiple text,
  ADD COLUMN IF NOT EXISTS closed_at      timestamptz;

COMMENT ON COLUMN companies.outcome        IS 'Terminal outcome once the deal resolves.';
COMMENT ON COLUMN companies.acquirer       IS 'Buyer / acquirer name (closed deals only).';
COMMENT ON COLUMN companies.close_multiple IS 'Exit multiple (e.g. "12.5x EBITDA"), free-text.';
COMMENT ON COLUMN companies.closed_at      IS 'Date the deal closed or was withdrawn.';
