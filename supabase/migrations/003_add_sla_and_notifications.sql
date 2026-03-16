-- Add SLA columns to change_events
ALTER TABLE change_events ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE change_events ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE change_events ADD COLUMN IF NOT EXISTS sla_status text DEFAULT 'ON_TRACK';
ALTER TABLE change_events ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- Notification outbox for async processing (Slack/email later)
CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  change_event_id uuid REFERENCES change_events(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'IN_APP',
  template_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_org ON notification_outbox(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_unsent ON notification_outbox(sent_at) WHERE sent_at IS NULL;

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_select ON notification_outbox;
CREATE POLICY outbox_select ON notification_outbox
FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS outbox_insert ON notification_outbox;
CREATE POLICY outbox_insert ON notification_outbox
FOR INSERT WITH CHECK (is_org_member(org_id));

-- SLA evaluation function
CREATE OR REPLACE FUNCTION evaluate_slas()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  -- Mark overdue
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

  -- Enqueue escalations (only once)
  INSERT INTO notification_outbox (org_id, change_event_id, channel, template_key, payload)
  SELECT ce.org_id, ce.id, 'IN_APP', 'escalation',
         jsonb_build_object('changeEventId', ce.id, 'due_at', ce.due_at, 'sla_status', ce.sla_status)
  FROM change_events ce
  WHERE ce.status = 'IN_REVIEW'
    AND ce.due_at IS NOT NULL
    AND ce.due_at < now_ts
    AND ce.escalated_at IS NULL;

  UPDATE change_events
  SET escalated_at = now_ts
  WHERE status = 'IN_REVIEW'
    AND due_at IS NOT NULL
    AND due_at < now_ts
    AND escalated_at IS NULL;

END;
$$;

-- Schedule with pg_cron (run manually in Supabase SQL Editor if needed):
-- SELECT cron.schedule('evaluate-slas-every-5-min', '*/5 * * * *', $$SELECT evaluate_slas();$$);