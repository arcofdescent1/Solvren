-- Phase 5 — Allow org members to insert decision logs (backend writes during ranking).
DROP POLICY IF EXISTS decision_logs_insert ON public.decision_logs;
CREATE POLICY decision_logs_insert ON public.decision_logs
  FOR INSERT WITH CHECK (public.is_org_member(org_id));
