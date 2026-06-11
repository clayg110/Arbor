-- Conversion funnel cohorts: how many companies entered each stage per calendar month.
-- Gives the analytics page a time-series view of pipeline entry rates.
CREATE OR REPLACE VIEW v_funnel_cohorts AS
SELECT
  date_trunc('month', changed_at)::date AS cohort_month,
  stage,
  count(*) AS entries
FROM deal_stage_history
WHERE changed_at >= now() - interval '12 months'
  AND stage IN ('in_market', 'monitor_for_exit', 'on_hold', 'pulled')
GROUP BY 1, 2
ORDER BY 1, 2;

-- Exit multiples by sector: median and average close_multiple for closed deals.
-- close_multiple is stored as text like "8.2x" or "8.2" — strip trailing 'x'.
CREATE OR REPLACE VIEW v_valuation_multiples AS
SELECT
  c.sector,
  count(*) AS deals,
  round(
    avg(CAST(REGEXP_REPLACE(c.close_multiple, 'x$', '') AS numeric)), 1
  ) AS avg_multiple,
  round(
    (percentile_cont(0.5) WITHIN GROUP (
      ORDER BY CAST(REGEXP_REPLACE(c.close_multiple, 'x$', '') AS numeric)
    ))::numeric,
    1
  ) AS median_multiple
FROM companies c
WHERE c.outcome = 'closed'
  AND c.close_multiple IS NOT NULL
  AND c.close_multiple ~ '^[0-9]+(\.[0-9]+)?x?$'
GROUP BY c.sector
ORDER BY deals DESC;

-- Win/loss summary by sector and confidence band.
CREATE OR REPLACE VIEW v_win_loss AS
SELECT
  sector,
  confidence,
  count(*) FILTER (WHERE outcome = 'closed') AS wins,
  count(*) FILTER (WHERE outcome = 'withdrawn') AS losses
FROM companies
WHERE outcome IS NOT NULL
GROUP BY sector, confidence;
