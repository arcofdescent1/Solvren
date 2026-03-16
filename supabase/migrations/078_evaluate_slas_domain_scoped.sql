-- Phase 3.2 — evaluate_slas(): domain-scoped due_at/sla_status from org_domain_policies + domain_sla_policies;
-- notification dedupe keys include domain to avoid cross-domain collisions.

CREATE OR REPLACE FUNCTION public.evaluate_slas()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts timestamptz := now();
  rec RECORD;
  policy_key text;
  due_hours int;
  due_soon_hours int;
  escalation_hours int;
  computed_due_at timestamptz;
  computed_sla_status text;
  domain_key text;
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
  -- Step 1: Update due_at and sla_status from domain policy for all non-terminal changes with submitted_at
  FOR rec IN
    SELECT
      ce.id,
      ce.org_id,
      coalesce(ce.domain, 'REVENUE') as dom_key,
      ce.submitted_at,
      ce.due_at,
      ce.sla_status,
      ce.status
    FROM public.change_events ce
    WHERE ce.submitted_at IS NOT NULL
      AND (ce.status IS NULL OR ce.status NOT IN ('APPROVED','REJECTED','CLOSED','RESOLVED'))
  LOOP
    domain_key := rec.dom_key;

    SELECT odp.sla_policy_key
      INTO policy_key
    FROM public.org_domain_policies odp
    WHERE odp.org_id = rec.org_id
      AND odp.domain_key = domain_key
    LIMIT 1;

    IF policy_key IS NULL THEN
      policy_key := 'DEFAULT';
    END IF;

    SELECT dsp.due_hours, dsp.due_soon_hours, dsp.escalation_hours
      INTO due_hours, due_soon_hours, escalation_hours
    FROM public.domain_sla_policies dsp
    WHERE dsp.domain_key = domain_key
      AND dsp.policy_key = policy_key
    LIMIT 1;

    IF due_hours IS NULL THEN
      due_hours := 48; due_soon_hours := 24; escalation_hours := 72;
    END IF;

    computed_due_at := rec.submitted_at + make_interval(hours => due_hours);

    IF now_ts < computed_due_at - make_interval(hours => due_soon_hours) THEN
      computed_sla_status := 'ON_TRACK';
    ELSIF now_ts < computed_due_at THEN
      computed_sla_status := 'DUE_SOON';
    ELSE
      computed_sla_status := 'OVERDUE';
    END IF;

    UPDATE public.change_events
      SET due_at = computed_due_at,
          sla_status = computed_sla_status
    WHERE id = rec.id
      AND (due_at IS DISTINCT FROM computed_due_at OR sla_status IS DISTINCT FROM computed_sla_status);
  END LOOP;

  -- Step 2: Notification loop (same logic as 060, with domain in dedupe keys)
  FOR rec IN
      SELECT
        ce.id,
        ce.org_id,
        coalesce(ce.domain, 'REVENUE') as dom_key,
        ce.due_at,
        ce.sla_status,
        ce.escalated_at
      FROM public.change_events ce
      WHERE ce.status = 'IN_REVIEW'
        AND ce.due_at IS NOT NULL
    LOOP
      domain_key := rec.dom_key;

      SELECT ia.risk_bucket
        INTO risk_bucket_val
      FROM public.impact_assessments ia
      WHERE ia.change_event_id = rec.id
      ORDER BY ia.created_at DESC
      LIMIT 1;

      IF rec.due_at < now_ts THEN
        new_status := 'OVERDUE';
      ELSIF rec.due_at <= now_ts + interval '24 hours' THEN
        new_status := 'DUE_SOON';
      ELSE
        new_status := 'ON_TRACK';
      END IF;

      IF rec.escalated_at IS NOT NULL THEN
        new_status := 'ESCALATED';
      END IF;

      IF COALESCE(rec.sla_status, 'ON_TRACK') <> new_status THEN
        UPDATE public.change_events
        SET sla_status = new_status
        WHERE id = rec.id;
      END IF;

      -- Dedupe base includes domain to avoid cross-domain collisions
      dedupe_base := rec.org_id::text || ':' || domain_key || ':' || rec.id::text || ':' || day_key || ':';

      IF new_status = 'DUE_SOON' AND rec.escalated_at IS NULL THEN
        payload_val := jsonb_build_object(
          'changeEventId', rec.id,
          'risk_bucket', risk_bucket_val,
          'due_at', rec.due_at
        );

        INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'IN_APP', 'sla_due_soon', payload_val, dedupe_base || 'IN_APP:sla_due_soon')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'SLACK', 'sla_due_soon', payload_val, dedupe_base || 'SLACK:sla_due_soon')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

        INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
        VALUES (rec.org_id, rec.id, 'EMAIL', 'sla_due_soon', payload_val, dedupe_base || 'EMAIL:sla_due_soon')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
      END IF;

      IF new_status IN ('OVERDUE','ESCALATED') THEN
        overdue_mins := GREATEST(0, EXTRACT(EPOCH FROM (now_ts - rec.due_at)) / 60)::bigint;

        SELECT (
          (SELECT count(*) FROM public.approvals WHERE change_event_id = rec.id) > 0
          AND (SELECT count(*) FROM public.approvals WHERE change_event_id = rec.id)
            = (SELECT count(*) FROM public.approvals WHERE change_event_id = rec.id AND decision = 'APPROVED')
        )
        INTO all_approved;

        SELECT CASE risk_bucket_val
          WHEN 'LOW' THEN ARRAY[]::text[]
          WHEN 'MEDIUM' THEN ARRAY['PR']
          WHEN 'HIGH' THEN ARRAY['PR','TEST_PLAN']
          WHEN 'VERY_HIGH' THEN ARRAY['PR','TEST_PLAN','RUNBOOK','ROLLBACK']
          WHEN 'CRITICAL' THEN ARRAY['PR','TEST_PLAN','RUNBOOK','ROLLBACK','DASHBOARD','COMMS_PLAN']
          ELSE ARRAY[]::text[]
        END
        INTO required_kinds;

        SELECT array_agg(DISTINCT kind)
        INTO evidence_kinds
        FROM public.change_evidence
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

        IF new_status = 'OVERDUE' THEN
          payload_val := jsonb_build_object(
            'changeEventId', rec.id,
            'risk_bucket', risk_bucket_val,
            'due_at', rec.due_at,
            'overdue_by_minutes', overdue_mins
          );

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'IN_APP', 'sla_overdue', payload_val, dedupe_base || 'IN_APP:sla_overdue')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'SLACK', 'sla_overdue', payload_val, dedupe_base || 'SLACK:sla_overdue')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'EMAIL', 'sla_overdue', payload_val, dedupe_base || 'EMAIL:sla_overdue')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
        END IF;

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

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'IN_APP', 'evidence_missing', payload_val, dedupe_base || 'IN_APP:evidence_missing')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'SLACK', 'evidence_missing', payload_val, dedupe_base || 'SLACK:evidence_missing')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'EMAIL', 'evidence_missing', payload_val, dedupe_base || 'EMAIL:evidence_missing')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
        END IF;

        IF should_escalate AND rec.escalated_at IS NULL THEN
          UPDATE public.change_events
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

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'IN_APP', 'sla_escalated', payload_val, dedupe_base || 'IN_APP:sla_escalated')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'SLACK', 'sla_escalated', payload_val, dedupe_base || 'SLACK:sla_escalated')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

          INSERT INTO public.notification_outbox (org_id, change_event_id, channel, template_key, payload, dedupe_key)
          VALUES (rec.org_id, rec.id, 'EMAIL', 'sla_escalated', payload_val, dedupe_base || 'EMAIL:sla_escalated')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
        END IF;
      END IF;
  END LOOP;
END;
$$;
