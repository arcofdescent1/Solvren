-- RLS for incidents, change_signal_snapshot, signal_statistics
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_signal_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_statistics ENABLE ROW LEVEL SECURITY;

-- Incidents: org members can view and create
DROP POLICY IF EXISTS incidents_select ON incidents;
CREATE POLICY incidents_select ON incidents FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS incidents_insert ON incidents;
CREATE POLICY incidents_insert ON incidents FOR INSERT
  WITH CHECK (is_org_member(org_id) AND created_by = auth.uid());

-- Change signal snapshot: org members can view (written by submit route)
DROP POLICY IF EXISTS css_select ON change_signal_snapshot;
CREATE POLICY css_select ON change_signal_snapshot FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS css_insert ON change_signal_snapshot;
CREATE POLICY css_insert ON change_signal_snapshot FOR INSERT
  WITH CHECK (is_org_member(org_id));

-- Signal statistics: readable by all authenticated (written by cron RPC)
DROP POLICY IF EXISTS ss_select ON signal_statistics;
CREATE POLICY ss_select ON signal_statistics FOR SELECT USING (auth.uid() IS NOT NULL);
