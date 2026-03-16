-- Top risky changes by MRR × revenue risk score (actionable drivers)
-- Replaces simpler version from 094 with full row fields + p_limit

CREATE OR REPLACE FUNCTION public.exec_revenue_top_drivers(p_org_id uuid, p_days int DEFAULT 30, p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  since_ts timestamptz := now() - make_interval(days => p_days);
  rows jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'title', title,
    'status', status,
    'submitted_at', submitted_at,
    'due_at', due_at,
    'revenue_surface', revenue_surface,
    'estimated_mrr_affected', estimated_mrr_affected,
    'base_risk_score', base_risk_score,
    'exposure_multiplier', exposure_multiplier,
    'revenue_risk_score', revenue_risk_score,
    'revenue_at_risk', revenue_at_risk
  ) ORDER BY revenue_at_risk DESC), '[]'::jsonb)
  INTO rows
  FROM (
    SELECT
      ce.id,
      ce.title,
      ce.status,
      ce.submitted_at,
      ce.due_at,
      COALESCE(ce.revenue_surface::text, 'UNKNOWN') AS revenue_surface,
      COALESCE(ce.estimated_mrr_affected, 0) AS estimated_mrr_affected,
      COALESCE(ce.base_risk_score, 0) AS base_risk_score,
      COALESCE(ce.exposure_multiplier, 1) AS exposure_multiplier,
      COALESCE(
        ce.revenue_risk_score,
        COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1)
      ) AS revenue_risk_score,
      (
        COALESCE(ce.estimated_mrr_affected, 0) *
        COALESCE(
          ce.revenue_risk_score,
          COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1)
        )
      ) AS revenue_at_risk
    FROM public.change_events ce
    WHERE ce.org_id = p_org_id
      AND ce.submitted_at >= since_ts
      AND COALESCE(ce.status, '') NOT IN ('APPROVED','DONE','CLOSED')
    ORDER BY revenue_at_risk DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object(
    'since', to_char(since_ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'drivers', rows
  );
END;
$$;
