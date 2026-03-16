-- Add evidence suggestion columns to impact_assessments
ALTER TABLE impact_assessments
ADD COLUMN IF NOT EXISTS missing_evidence_suggestions jsonb,
ADD COLUMN IF NOT EXISTS suggested_evidence_ran_at timestamptz;

-- Update evaluate_slas with completion guard: don't escalate if all approved AND evidence complete
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
BEGIN
  -- Mark overdue (only IN_REVIEW)
  UPDATE change_events
  SET sla_status = 'OVERDUE'
  WHERE due_at IS NOT NULL
    AND status = 'IN_REVIEW'
    AND due_at < now_ts;

  -- Mark due soon (within 4 hours)
  UPDATE change_events
  SET sla_status = 'DUE_SOON'
  WHERE due_at IS NOT NULL
    AND status = 'IN_REVIEW'
    AND due_at >= now_ts
    AND due_at <= now_ts + interval '4 hours';

  -- Otherwise on track
  UPDATE change_events
  SET sla_status = 'ON_TRACK'
  WHERE due_at IS NOT NULL
    AND status = 'IN_REVIEW'
    AND due_at > now_ts + interval '4 hours';

  -- Enqueue escalations with completion guard: only if not (all approved AND evidence complete)
  FOR rec IN
    SELECT ce.id, ce.org_id, ce.due_at, ce.sla_status
    FROM change_events ce
    WHERE ce.status = 'IN_REVIEW'
      AND ce.due_at IS NOT NULL
      AND ce.due_at < now_ts
      AND ce.escalated_at IS NULL
  LOOP
    -- Check: all approvals approved?
    SELECT (
      SELECT count(*) FROM approvals WHERE change_event_id = rec.id
    ) = (
      SELECT count(*) FROM approvals WHERE change_event_id = rec.id AND decision = 'APPROVED'
    ) AND (SELECT count(*) FROM approvals WHERE change_event_id = rec.id) > 0
    INTO all_approved;

    -- Required evidence by bucket (mirror app logic)
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

    IF should_escalate THEN
      INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload)
      VALUES (rec.org_id, rec.id, 'IN_APP', 'escalation',
        jsonb_build_object('changeEventId', rec.id, 'due_at', rec.due_at, 'sla_status', rec.sla_status));

      UPDATE change_events
      SET escalated_at = now_ts
      WHERE id = rec.id;
    END IF;
  END LOOP;

END;
$$;
