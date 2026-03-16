-- Correlation engine: compute incident rates per signal (14-day window)
CREATE OR REPLACE FUNCTION public.compute_signal_statistics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  correlation_days int := 14;
BEGIN
  WITH signal_changes AS (
    SELECT
      css.signal_key,
      css.change_event_id,
      ce.org_id,
      ce.submitted_at
    FROM change_signal_snapshot css
    JOIN change_events ce ON ce.id = css.change_event_id
    WHERE ce.submitted_at IS NOT NULL
  ),
  linked_incidents AS (
    SELECT
      sc.signal_key,
      COUNT(DISTINCT i.id)::integer AS incident_count
    FROM signal_changes sc
    JOIN incidents i
      ON i.org_id = sc.org_id
      AND i.detected_at BETWEEN sc.submitted_at
        AND sc.submitted_at + (correlation_days || ' days')::interval
    GROUP BY sc.signal_key
  ),
  signal_totals AS (
    SELECT
      signal_key,
      COUNT(DISTINCT change_event_id)::integer AS total_changes
    FROM change_signal_snapshot
    GROUP BY signal_key
  ),
  computed AS (
    SELECT
      st.signal_key,
      st.total_changes,
      COALESCE(li.incident_count, 0) AS incident_count,
      CASE
        WHEN st.total_changes = 0 THEN 0
        ELSE COALESCE(li.incident_count, 0)::numeric / st.total_changes
      END AS incident_rate
    FROM signal_totals st
    LEFT JOIN linked_incidents li ON li.signal_key = st.signal_key
  )
  INSERT INTO signal_statistics (
    signal_key,
    total_changes,
    incident_count,
    incident_rate,
    last_computed_at
  )
  SELECT
    signal_key,
    total_changes,
    incident_count,
    incident_rate,
    now()
  FROM computed
  ON CONFLICT (signal_key) DO UPDATE SET
    total_changes = EXCLUDED.total_changes,
    incident_count = EXCLUDED.incident_count,
    incident_rate = EXCLUDED.incident_rate,
    last_computed_at = EXCLUDED.last_computed_at;
END;
$$;
