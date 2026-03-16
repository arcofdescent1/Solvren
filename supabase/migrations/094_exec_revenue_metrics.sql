-- Executive revenue metrics RPC (Revenue at Risk 30d + breakdown + trend)
-- Uses effective revenue risk score: COALESCE(revenue_risk_score, base_risk_score * exposure_multiplier)

CREATE OR REPLACE FUNCTION public.exec_revenue_metrics(p_org_id uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  since_ts timestamptz := now() - make_interval(days => p_days);
  revenue_at_risk numeric := 0;

  surface_rows jsonb := '[]'::jsonb;
  trend_rows jsonb := '[]'::jsonb;

  critical_pending int := 0;
  overdue_count int := 0;

BEGIN
  -- 1) Revenue at risk total
  SELECT COALESCE(SUM(
    COALESCE(ce.estimated_mrr_affected, 0) *
    COALESCE(ce.revenue_risk_score, COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1))
  ), 0)
  INTO revenue_at_risk
  FROM public.change_events ce
  WHERE ce.org_id = p_org_id
    AND ce.submitted_at >= since_ts
    AND COALESCE(ce.status, '') NOT IN ('APPROVED','DONE','CLOSED');

  -- 2) Breakdown by revenue_surface
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'revenue_surface', revenue_surface,
    'revenue_at_risk', revenue_at_risk_surface,
    'count', change_count
  ) ORDER BY revenue_at_risk_surface DESC), '[]'::jsonb)
  INTO surface_rows
  FROM (
    SELECT
      COALESCE(ce.revenue_surface::text, 'UNKNOWN') AS revenue_surface,
      COALESCE(SUM(
        COALESCE(ce.estimated_mrr_affected, 0) *
        COALESCE(ce.revenue_risk_score, COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1))
      ), 0) AS revenue_at_risk_surface,
      COUNT(*) AS change_count
    FROM public.change_events ce
    WHERE ce.org_id = p_org_id
      AND ce.submitted_at >= since_ts
      AND COALESCE(ce.status, '') NOT IN ('APPROVED','DONE','CLOSED')
    GROUP BY 1
  ) t;

  -- 3) Trend line (daily buckets)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day', day,
    'revenue_at_risk', revenue_at_risk_day
  ) ORDER BY day ASC), '[]'::jsonb)
  INTO trend_rows
  FROM (
    SELECT
      to_char(date_trunc('day', ce.submitted_at), 'YYYY-MM-DD') AS day,
      COALESCE(SUM(
        COALESCE(ce.estimated_mrr_affected, 0) *
        COALESCE(ce.revenue_risk_score, COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1))
      ), 0) AS revenue_at_risk_day
    FROM public.change_events ce
    WHERE ce.org_id = p_org_id
      AND ce.submitted_at >= since_ts
      AND COALESCE(ce.status, '') NOT IN ('APPROVED','DONE','CLOSED')
    GROUP BY 1
  ) d;

  -- 4) Critical changes pending (revenue_risk_score >= 0.7 OR exposure_multiplier >= 4)
  SELECT COUNT(*)
  INTO critical_pending
  FROM public.change_events ce
  WHERE ce.org_id = p_org_id
    AND ce.submitted_at >= since_ts
    AND COALESCE(ce.status, '') NOT IN ('APPROVED','DONE','CLOSED')
    AND (
      COALESCE(ce.revenue_risk_score, COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1)) >= 0.7
      OR COALESCE(ce.exposure_multiplier, 1) >= 4
    );

  -- 5) Overdue changes
  SELECT COUNT(*)
  INTO overdue_count
  FROM public.change_events ce
  WHERE ce.org_id = p_org_id
    AND COALESCE(ce.status, '') NOT IN ('APPROVED','DONE','CLOSED')
    AND ce.due_at IS NOT NULL
    AND ce.due_at < now();

  RETURN jsonb_build_object(
    'since', to_char(since_ts, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'revenue_at_risk', revenue_at_risk,
    'by_surface', surface_rows,
    'trend', trend_rows,
    'critical_pending', critical_pending,
    'overdue_count', overdue_count
  );
END;
$$;

-- Optional: Top 10 changes by MRR × revenue risk score (actionable drivers)
CREATE OR REPLACE FUNCTION public.exec_revenue_top_drivers(p_org_id uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  since_ts timestamptz := now() - make_interval(days => p_days);
  drivers jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO drivers
  FROM (
    SELECT
      ce.id,
      ce.title,
      ce.revenue_surface::text AS revenue_surface,
      ce.estimated_mrr_affected,
      COALESCE(ce.revenue_risk_score, COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1)) AS score,
      (COALESCE(ce.estimated_mrr_affected, 0) *
        COALESCE(ce.revenue_risk_score, COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1))) AS revenue_at_risk
    FROM public.change_events ce
    WHERE ce.org_id = p_org_id
      AND ce.submitted_at >= since_ts
      AND COALESCE(ce.status, '') NOT IN ('APPROVED','DONE','CLOSED')
    ORDER BY (COALESCE(ce.estimated_mrr_affected, 0) *
      COALESCE(ce.revenue_risk_score, COALESCE(ce.base_risk_score, 0) * COALESCE(ce.exposure_multiplier, 1))) DESC
    LIMIT 10
  ) t;

  RETURN drivers;
END;
$$;
