-- Phase 2 RLS: incidents UPDATE, audit_log

-- Incidents: allow UPDATE for org members (edit/resolve/unlink/link)
DROP POLICY IF EXISTS incidents_update ON incidents;
CREATE POLICY incidents_update ON incidents FOR UPDATE
  USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- Audit log: org-scoped read; insert from server (service role) or org member
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      org_id = '00000000-0000-0000-0000-000000000000'
      OR is_org_member(org_id)
    )
  );

DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      org_id = '00000000-0000-0000-0000-000000000000'
      OR is_org_member(org_id)
    )
  );
