-- Read model for in-app notifications (fan-out from notification_outbox)

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_event_id uuid REFERENCES change_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'INFO',
  cta_label text,
  cta_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user ON in_app_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread ON in_app_notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS in_app_notif_select ON in_app_notifications;
CREATE POLICY in_app_notif_select ON in_app_notifications
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS in_app_notif_insert ON in_app_notifications;
CREATE POLICY in_app_notif_insert ON in_app_notifications
FOR INSERT WITH CHECK (is_org_member(org_id));

DROP POLICY IF EXISTS in_app_notif_update ON in_app_notifications;
CREATE POLICY in_app_notif_update ON in_app_notifications
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
