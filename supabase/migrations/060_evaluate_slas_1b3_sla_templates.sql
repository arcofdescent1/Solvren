-- Patch 1B.3 — Update evaluate_slas: sla_due_soon/sla_overdue/sla_escalated + ON CONFLICT dedupe
-- - Enqueues sla_due_soon when entering DUE_SOON (not just when escalated_at is null)
-- - Enqueues sla_overdue when entering OVERDUE
-- - Enqueues sla_escalated when escalating (sets sla_status = 'ESCALATED')
-- - Enqueues evidence_missing when evidence incomplete (overdue/escalated path)
-- - Uses ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING (relies on notification_outbox_dedupe_unique)

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
  risk_bucket_val text;
  payload_val jsonb;

  new_status text;
  dedupe_base text;
  day_key text := to_char(now_ts at time zone 'utc', 'YYYY-MM-DD');
BEGIN
  FOR rec IN
    SELECT
      ce.id,
      ce.org_id,
      ce.due_at,
      ce.sla_status,
      ce.escalated_at
    FROM change_events ce
    WHERE ce.status = 'IN_REVIEW'
      AND ce.due_at IS NOT NULL
  LOOP
    -- Determine current risk bucket (latest)
    SELECT ia.risk_bucket
      INTO risk_bucket_val
    FROM impact_assessments ia
    WHERE ia.change_event_id = rec.id
    ORDER BY ia.created_at DESC
    LIMIT 1;

    -- Determine baseline SLA status (not including escalation)
    IF rec.due_at < now_ts THEN
      new_status := 'OVERDUE';
    ELSIF rec.due_at <= now_ts + interval '24 hours' THEN
      new_status := 'DUE_SOON';
    ELSE
      new_status := 'ON_TRACK';
    END IF;

    -- If previously escalated, keep it escalated
    IF rec.escalated_at IS NOT NULL THEN
      new_status := 'ESCALATED';
    END IF;

    -- Update SLA status only if it changed
    IF COALESCE(rec.sla_status, 'ON_TRACK') <> new_status THEN
      UPDATE change_events
      SET sla_status = new_status
      WHERE id = rec.id;
    END IF;

    -- Dedupe base (per change per day)
    dedupe_base := rec.org_id::text || ':' || rec.id::text || ':' || day_key || ':';

    -- DUE_SOON notification (only when entering DUE_SOON and not already escalated)
    IF new_status = 'DUE_SOON' AND rec.escalated_at IS NULL THEN
      payload_val := jsonb_build_object(
        'changeEventId', rec.id,
        'risk_bucket', risk_bucket_val,
        'due_at', rec.due_at
      );

      INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
      VALUES (rec.org_id, rec.id, 'IN_APP', 'sla_due_soon', payload_val, dedupe_base || 'IN_APP:sla_due_soon')
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

      INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
      VALUES (rec.org_id, rec.id, 'SLACK', 'sla_due_soon', payload_val, dedupe_base || 'SLACK:sla_due_soon')
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

      INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
      VALUES (rec.org_id, rec.id, 'EMAIL', 'sla_due_soon', payload_val, dedupe_base || 'EMAIL:sla_due_soon')
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    END IF;

    -- OVERDUE path
    IF new_status IN ('OVERDUE','ESCALATED') THEN
      overdue_mins := GREATEST(0, EXTRACT(EPOCH FROM (now_ts - rec.due_at)) / 60)::bigint;

      -- All approvals approved?
      SELECT (
        (SELECT count(*) FROM approvals WHERE change_event_id = rec.id) > 0
        AND (SELECT count(*) FROM approvals WHERE change_event_id = rec.id)
          = (SELECT count(*) FROM approvals WHERE change_event_id = rec.id AND decision = 'APPROVED')
      )
      INTO all_approved;

      -- Required evidence kinds by risk bucket
      SELECT CASE risk_bucket_val
        WHEN 'LOW' THEN ARRAY[]::text[]
        WHEN 'MEDIUM' THEN ARRAY['PR']
        WHEN 'HIGH' THEN ARRAY['PR','TEST_PLAN']
        WHEN 'VERY_HIGH' THEN ARRAY['PR','TEST_PLAN','RUNBOOK','ROLLBACK']
        WHEN 'CRITICAL' THEN ARRAY['PR','TEST_PLAN','RUNBOOK','ROLLBACK','DASHBOARD','COMMS_PLAN']
        ELSE ARRAY[]::text[]
      END
      INTO required_kinds;

      -- Evidence kinds present
      SELECT array_agg(DISTINCT kind)
      INTO evidence_kinds
      FROM change_evidence
      WHERE change_event_id = rec.id
        AND kind IS NOT NULL;

      evidence_complete := (
        required_kinds = ARRAY[]::text[]
        OR (
          evidence_kinds IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(required_kinds) r(k)
            WHERE NOT (r.k = ANY(COALESCE(evidence_kinds, ARRAY[]::text[])))
          )
        )
      );

      should_escalate := NOT (COALESCE(all_approved, false) AND evidence_complete);

      -- If overdue (not yet escalated), emit sla_overdue (daily deduped)
      IF new_status = 'OVERDUE' THEN
        payload_val := jsonb_build_object(
          'changeEventId', rec.id,
          'risk_bucket', risk_bucket_val,
          'due_at', rec.due_at,
          'overdue_by_minutes', overdue_mins
        );

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'IN_APP', 'sla_overdue', payload_val, dedupe_base || 'IN_APP:sla_overdue')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'SLACK', 'sla_overdue', payload_val, dedupe_base || 'SLACK:sla_overdue')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'EMAIL', 'sla_overdue', payload_val, dedupe_base || 'EMAIL:sla_overdue')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
      END IF;

      -- Evidence missing notification (only if incomplete)
      IF NOT evidence_complete AND required_kinds <> ARRAY[]::text[] THEN
        payload_val := jsonb_build_object(
          'changeEventId', rec.id,
          'risk_bucket', risk_bucket_val,
          'missingEvidenceKinds', (
            SELECT COALESCE(array_agg(t.k), ARRAY[]::text[])
            FROM unnest(required_kinds) AS t(k)
            WHERE NOT (t.k = ANY(COALESCE(evidence_kinds, ARRAY[]::text[])))
          )
        );

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'IN_APP', 'evidence_missing', payload_val, dedupe_base || 'IN_APP:evidence_missing')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'SLACK', 'evidence_missing', payload_val, dedupe_base || 'SLACK:evidence_missing')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'EMAIL', 'evidence_missing', payload_val, dedupe_base || 'EMAIL:evidence_missing')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
      END IF;

      -- Escalate automatically if overdue and not approved/evidence-complete
      IF should_escalate AND rec.escalated_at IS NULL THEN
        UPDATE change_events
        SET escalated_at = now_ts,
            sla_status = 'ESCALATED',
            last_notified_at = now_ts
        WHERE id = rec.id;

        payload_val := jsonb_build_object(
          'changeEventId', rec.id,
          'risk_bucket', risk_bucket_val,
          'due_at', rec.due_at,
          'overdue_by_minutes', overdue_mins
        );

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'IN_APP', 'sla_escalated', payload_val, dedupe_base || 'IN_APP:sla_escalated')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'SLACK', 'sla_escalated', payload_val, dedupe_base || 'SLACK:sla_escalated')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'EMAIL', 'sla_escalated', payload_val, dedupe_base || 'EMAIL:sla_escalated')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
      END IF;
    END IF;

  END LOOP;
END;
$$;
