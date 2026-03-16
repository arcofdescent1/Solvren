-- Update evaluate_slas: dedupe + multi-channel (IN_APP, SLACK, EMAIL)

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
  dedupe_base text;
  slack_enabled_flag boolean := false;
  email_enabled_flag boolean := false;
  slack_webhook_url_val text := NULL;
BEGIN
  FOR rec IN
    SELECT ce.id, ce.org_id, ce.due_at, ce.sla_status, ce.escalated_at, ce.last_notified_at, ce.created_by
    FROM change_events ce
    WHERE ce.status = 'IN_REVIEW'
      AND ce.due_at IS NOT NULL
  LOOP
    IF rec.due_at < now_ts THEN
      UPDATE change_events SET sla_status = 'OVERDUE' WHERE id = rec.id;
      overdue_mins := EXTRACT(EPOCH FROM (now_ts - rec.due_at)) / 60;
      risk_bucket_val := (SELECT risk_bucket FROM impact_assessments WHERE change_event_id = rec.id ORDER BY created_at DESC LIMIT 1);

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

      IF should_escalate AND rec.escalated_at IS NULL THEN
        SELECT COALESCE(slack_enabled, false), COALESCE(email_enabled, false), slack_webhook_url
        INTO slack_enabled_flag, email_enabled_flag, slack_webhook_url_val
        FROM organization_settings WHERE org_id = rec.org_id;

        payload_val := jsonb_build_object(
          'changeEventId', rec.id,
          'risk_bucket', risk_bucket_val,
          'due_at', rec.due_at,
          'overdue_by_minutes', overdue_mins
        );

        dedupe_base := rec.org_id::text || ':' || rec.id::text || ':';

        IF NOT EXISTS (
          SELECT 1 FROM notification_outbox no
          WHERE no.dedupe_key = dedupe_base || 'IN_APP:approval_overdue'
            AND no.created_at > now_ts - interval '6 hours'
        ) THEN
          INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'IN_APP', 'approval_overdue', payload_val, dedupe_base || 'IN_APP:approval_overdue');
        END IF;

        IF slack_enabled_flag = true AND slack_webhook_url_val IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM notification_outbox no
          WHERE no.dedupe_key = dedupe_base || 'SLACK:approval_overdue'
            AND no.created_at > now_ts - interval '6 hours'
        ) THEN
          INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'SLACK', 'approval_overdue', payload_val, dedupe_base || 'SLACK:approval_overdue');
        END IF;

        IF email_enabled_flag = true AND NOT EXISTS (
          SELECT 1 FROM notification_outbox no
          WHERE no.dedupe_key = dedupe_base || 'EMAIL:approval_overdue'
            AND no.created_at > now_ts - interval '6 hours'
        ) THEN
          INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'EMAIL', 'approval_overdue', payload_val, dedupe_base || 'EMAIL:approval_overdue');
        END IF;

        IF required_kinds <> ARRAY[]::text[] AND (
          evidence_kinds IS NULL OR EXISTS (
            SELECT 1 FROM unnest(required_kinds) r(k)
            WHERE NOT (r.k = ANY(COALESCE(evidence_kinds, ARRAY[]::text[])))
          )
        ) THEN
          payload_val := jsonb_build_object(
            'changeEventId', rec.id,
            'risk_bucket', risk_bucket_val,
            'missingEvidenceKinds', (
              SELECT COALESCE(array_agg(t.k), ARRAY[]::text[])
              FROM unnest(required_kinds) AS t(k)
              WHERE NOT (t.k = ANY(COALESCE(evidence_kinds, ARRAY[]::text[])))
            )
          );

          IF NOT EXISTS (
            SELECT 1 FROM notification_outbox no
            WHERE no.dedupe_key = dedupe_base || 'IN_APP:evidence_missing'
              AND no.created_at > now_ts - interval '6 hours'
          ) THEN
            INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
            VALUES (rec.org_id, rec.id, 'IN_APP', 'evidence_missing', payload_val, dedupe_base || 'IN_APP:evidence_missing');
          END IF;

          IF slack_enabled_flag = true AND slack_webhook_url_val IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM notification_outbox no
            WHERE no.dedupe_key = dedupe_base || 'SLACK:evidence_missing'
              AND no.created_at > now_ts - interval '6 hours'
          ) THEN
            INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
            VALUES (rec.org_id, rec.id, 'SLACK', 'evidence_missing', payload_val, dedupe_base || 'SLACK:evidence_missing');
          END IF;

          IF email_enabled_flag = true AND NOT EXISTS (
            SELECT 1 FROM notification_outbox no
            WHERE no.dedupe_key = dedupe_base || 'EMAIL:evidence_missing'
              AND no.created_at > now_ts - interval '6 hours'
          ) THEN
            INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
            VALUES (rec.org_id, rec.id, 'EMAIL', 'evidence_missing', payload_val, dedupe_base || 'EMAIL:evidence_missing');
          END IF;
        END IF;

        UPDATE change_events
        SET escalated_at = now_ts, last_notified_at = now_ts
        WHERE id = rec.id;
      END IF;

    ELSIF rec.due_at >= now_ts AND rec.due_at <= now_ts + interval '24 hours' THEN
      UPDATE change_events SET sla_status = 'DUE_SOON' WHERE id = rec.id;
    ELSE
      UPDATE change_events SET sla_status = 'ON_TRACK' WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;
