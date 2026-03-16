-- Allow org members to update notification_outbox (for delivery worker route)
DROP POLICY IF EXISTS outbox_update ON notification_outbox;
CREATE POLICY outbox_update ON notification_outbox
FOR UPDATE USING (is_org_member(org_id))
WITH CHECK (is_org_member(org_id));
