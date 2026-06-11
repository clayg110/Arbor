-- v_sponsor_holding: per-sponsor hold-period + exit cadence for private-asset deals.
-- avg_days_hold = avg days from deal created_at → first in_market stage transition.
-- exit_rate_pct = share of that sponsor's tracked deals that ever reached in_market.

CREATE OR REPLACE VIEW v_sponsor_holding AS
WITH first_market AS (
  SELECT
    company_id,
    MIN(changed_at) AS first_in_market_at
  FROM deal_stage_history
  WHERE stage = 'in_market'
  GROUP BY company_id
)
SELECT
  c.sponsor_firm                                                          AS sponsor,
  COUNT(DISTINCT c.id)                                                    AS total_deals,
  COUNT(DISTINCT fm.company_id)                                           AS market_count,
  ROUND(
    AVG(
      CASE WHEN fm.first_in_market_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (
          fm.first_in_market_at::timestamptz - c.created_at::timestamptz
        )) / 86400.0
      END
    )
  )::int                                                                  AS avg_days_hold,
  ROUND(
    100.0 * COUNT(DISTINCT fm.company_id)::numeric
    / NULLIF(COUNT(DISTINCT c.id), 0)
  )::int                                                                  AS exit_rate_pct,
  (
    SELECT c2.sector
    FROM companies c2
    WHERE c2.sponsor_firm = c.sponsor_firm
      AND c2.deal_type = 'private_asset'
    GROUP BY c2.sector
    ORDER BY COUNT(*) DESC, c2.sector ASC
    LIMIT 1
  )                                                                       AS top_sector
FROM companies c
LEFT JOIN first_market fm ON fm.company_id = c.id
WHERE c.deal_type = 'private_asset'
  AND c.sponsor_firm IS NOT NULL
GROUP BY c.sponsor_firm
ORDER BY total_deals DESC, market_count DESC;
