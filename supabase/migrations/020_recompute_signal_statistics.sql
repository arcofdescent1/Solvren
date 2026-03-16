CREATE OR REPLACE FUNCTION recompute_signal_statistics(window_days integer DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  baseline numeric;
BEGIN
  INSERT INTO signal_statistics (signal_key, total_changes, incident_count, incident_rate, last_computed_at)
  SELECT
    css.signal_key,
    count(distinct css.change_event_id)::integer AS total_changes,
    count(distinct i.id)::integer AS incident_count,
    CASE
      WHEN count(distinct css.change_event_id) = 0 THEN 0
      ELSE count(distinct i.id)::numeric / count(distinct css.change_event_id)::numeric
    END AS incident_rate,
    now() AS last_computed_at
  FROM change_signal_snapshot css
  JOIN change_events ce ON ce.id = css.change_event_id
  LEFT JOIN incidents i
    ON i.org_id = css.org_id
   AND i.detected_at >= ce.submitted_at
   AND i.detected_at < ce.submitted_at + (window_days || ' days')::interval
  WHERE ce.submitted_at IS NOT NULL
  GROUP BY css.signal_key
  ON CONFLICT (signal_key) DO UPDATE SET
    total_changes = EXCLUDED.total_changes,
    incident_count = EXCLUDED.incident_count,
    incident_rate = EXCLUDED.incident_rate,
    last_computed_at = EXCLUDED.last_computed_at;

  SELECT
    CASE
      WHEN sum(total_changes) = 0 THEN 0
      ELSE sum(incident_rate * total_changes)::numeric / sum(total_changes)::numeric
    END
  INTO baseline
  FROM signal_statistics;

  INSERT INTO risk_learning_baseline (id, baseline_incident_rate, last_computed_at)
  VALUES (1, coalesce(baseline, 0), now())
  ON CONFLICT (id) DO UPDATE SET
    baseline_incident_rate = EXCLUDED.baseline_incident_rate,
    last_computed_at = EXCLUDED.last_computed_at;
END;
$$;
