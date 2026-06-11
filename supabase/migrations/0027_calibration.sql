-- v_confidence_calibration: close rate per confidence band (resolved deals only).
-- "closed" = outcome = 'closed'.
-- "lost"   = outcome = 'withdrawn' OR current_stage = 'pulled'.
-- close_rate_pct is computed over resolved deals only (denominator excludes still-open).

CREATE OR REPLACE VIEW v_confidence_calibration AS
SELECT
  confidence,
  COUNT(*)                                                                      AS total,
  COUNT(*) FILTER (WHERE outcome = 'closed')                                   AS closed_count,
  COUNT(*) FILTER (
    WHERE outcome = 'withdrawn' OR current_stage = 'pulled'
  )                                                                             AS lost_count,
  COALESCE(
    ROUND(
      100.0
      * COUNT(*) FILTER (WHERE outcome = 'closed')::numeric
      / NULLIF(
          COUNT(*) FILTER (
            WHERE outcome = 'closed'
               OR outcome = 'withdrawn'
               OR current_stage = 'pulled'
          ),
          0
        )
    )::int,
    0
  )                                                                             AS close_rate_pct
FROM companies
GROUP BY confidence
ORDER BY
  CASE confidence
    WHEN 'high'         THEN 1
    WHEN 'medium'       THEN 2
    WHEN 'low'          THEN 3
    WHEN 'needs_review' THEN 4
    ELSE 5
  END;
