-- Phase 3.2: Enhanced SLA evaluator with state transitions and templates

CREATE OR REPLACE FUNCTION evaluate_slas()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts timestamptz := now();
  rec RECORD;
  required_kinds text[];
  evidence_kinds text[];
  all_approved boolean;
  evidence_complete boolean;
  should_escalate boolean;
  overdue_mins bigint;
  prev_status text;
BEGIN
  -- Only process IN_REVIEW changes
  FOR rec IN
    SELECT ce.id, ce.org_id, ce.due_at, ce.sla_status, ce.escalated_at, ce.last_notified_at, ce.created_by
    FROM change_events ce
    WHERE ce.status = 'IN_REVIEW'
      AND ce.due_at IS NOT NULL
  LOOP
    prev_status := rec.sla_status;

    -- Compute new SLA status
    IF rec.due_at < now_ts THEN
      -- OVERDUE
      UPDATE change_events
      SET sla_status = 'OVERDUE'
      WHERE id = rec.id;

      overdue_mins := EXTRACT(EPOCH FROM (now_ts - rec.due_at)) / 60;

      -- Completion guard: don't escalate if all approved AND evidence complete
      SELECT (
        SELECT count(*) FROM approvals WHERE change_event_id = rec.id
      ) = (
        SELECT count(*) FROM approvals WHERE change_event_id = rec.id AND decision = 'APPROVED'
      ) AND (SELECT count(*) FROM approvals WHERE change_event_id = rec.id) > 0
      INTO all_approved;

      SELECT CASE (SELECT risk_bucket FROM impact_assessments WHERE change_event_id = rec.id ORDER BY created_at DESC LIMIT 1)
        WHEN 'LOW' THEN ARRAY[]::text[]
        WHEN 'MEDIUM' THEN ARRAY['PR']
        WHEN 'HIGH' THEN ARRAY['PR','TEST_PLAN']
        WHEN 'VERY_HIGH' THEN ARRAY['PR','TEST_PLAN','RUNBOOK','ROLLBACK']
        WHEN 'CRITICAL' THEN ARRAY['PR','TEST_PLAN','RUNBOOK','ROLLBACK','DASHBOARD','COMMS_PLAN']
        ELSE ARRAY[]::text[]
      END INTO required_kinds;

      SELECT array_agg(DISTINCT kind) INTO evidence_kinds
      FROM change_evidence WHERE change_event_id = rec.id AND kind IS NOT NULL;

      evidence_complete := (
        required_kinds = ARRAY[]::text[]
        OR (
          evidence_kinds IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM unnest(required_kinds) r(k)
            WHERE NOT (r.k = ANY(COALESCE(evidence_kinds, ARRAY[]::text[])))
          )
        )
      );

      should_escalate := NOT (COALESCE(all_approved, false) AND evidence_complete);

      -- Insert outbox when crossing to OVERDUE (throttle: escalated_at was null)
      IF should_escalate AND rec.escalated_at IS NULL THEN
        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload)
        VALUES (
          rec.org_id,
          rec.id,
          'IN_APP',
          'approval_overdue',
          jsonb_build_object(
            'changeEventId', rec.id,
            'risk_bucket', (SELECT risk_bucket FROM impact_assessments WHERE change_event_id = rec.id ORDER BY created_at DESC LIMIT 1),
            'due_at', rec.due_at,
            'overdue_by_minutes', overdue_mins
          )
        );

        -- evidence_missing if missing required evidence
        IF required_kinds <> ARRAY[]::text[] AND (
          evidence_kinds IS NULL OR EXISTS (
            SELECT 1 FROM unnest(required_kinds) r(k)
            WHERE NOT (r.k = ANY(COALESCE(evidence_kinds, ARRAY[]::text[])))
          )
        ) THEN
          INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload)
          VALUES (
            rec.org_id,
            rec.id,
            'IN_APP',
            'evidence_missing',
            jsonb_build_object(
              'changeEventId', rec.id,
              'risk_bucket', (SELECT risk_bucket FROM impact_assessments WHERE change_event_id = rec.id ORDER BY created_at DESC LIMIT 1),
              'missingEvidenceKinds', (
              SELECT COALESCE(array_agg(t.k), ARRAY[]::text[])
              FROM unnest(required_kinds) AS t(k)
              WHERE NOT (t.k = ANY(COALESCE(evidence_kinds, ARRAY[]::text[])))
            )
            )
          );
        END IF;

        UPDATE change_events
        SET escalated_at = now_ts,
            last_notified_at = now_ts
        WHERE id = rec.id;
      END IF;

    ELSIF rec.due_at >= now_ts AND rec.due_at <= now_ts + interval '24 hours' THEN
      -- DUE_SOON (within 24h)
      UPDATE change_events
      SET sla_status = 'DUE_SOON'
      WHERE id = rec.id;

    ELSE
      -- ON_TRACK
      UPDATE change_events
      SET sla_status = 'ON_TRACK'
      WHERE id = rec.id;

    END IF;
  END LOOP;

END;
$$;

-- Schedule with pg_cron (run manually in Supabase SQL Editor if pg_cron is enabled):
-- SELECT cron.schedule('evaluate-slas-every-5-min', '*/5 * * * *', $$SELECT evaluate_slas();$$);
