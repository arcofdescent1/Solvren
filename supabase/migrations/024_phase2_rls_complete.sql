-- Phase 2 complete RLS: org-scoped with EXISTS, global aggregates read-only for authenticated

-- Incidents: drop old, create org-scoped with EXISTS
DROP POLICY IF EXISTS incidents_select ON incidents;
DROP POLICY IF EXISTS incidents_insert ON incidents;
DROP POLICY IF EXISTS incidents_update ON incidents;

CREATE POLICY "incidents_select_org" ON incidents FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organization_members m
  WHERE m.org_id = incidents.org_id AND m.user_id = auth.uid()
));

CREATE POLICY "incidents_insert_org" ON incidents FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organization_members m
  WHERE m.org_id = incidents.org_id AND m.user_id = auth.uid()
));

CREATE POLICY "incidents_update_org" ON incidents FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organization_members m
  WHERE m.org_id = incidents.org_id AND m.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM organization_members m
  WHERE m.org_id = incidents.org_id AND m.user_id = auth.uid()
));

-- Change signal snapshot: drop old, select only (insert via service role)
DROP POLICY IF EXISTS css_select ON change_signal_snapshot;
DROP POLICY IF EXISTS css_insert ON change_signal_snapshot;

CREATE POLICY "snapshot_select_org" ON change_signal_snapshot FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organization_members m
  WHERE m.org_id = change_signal_snapshot.org_id AND m.user_id = auth.uid()
));

-- Audit log: drop old, select only (insert via service role)
DROP POLICY IF EXISTS audit_log_select ON audit_log;
DROP POLICY IF EXISTS audit_log_insert ON audit_log;

CREATE POLICY "audit_select_org" ON audit_log FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    audit_log.org_id = '00000000-0000-0000-0000-000000000000'
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = audit_log.org_id AND m.user_id = auth.uid()
    )
  )
);

-- Global aggregates: drop old, read for authenticated only (write = service role)
DROP POLICY IF EXISTS ss_select ON signal_statistics;
DROP POLICY IF EXISTS rlb_select ON risk_learning_baseline;

CREATE POLICY "signal_statistics_read_auth" ON signal_statistics FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "risk_learning_baseline_read_auth" ON risk_learning_baseline FOR SELECT
TO authenticated
USING (true);
