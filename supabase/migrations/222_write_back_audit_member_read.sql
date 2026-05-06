-- Trust metrics: any org member may read write-back audit (denials are non-sensitive aggregates).

DROP POLICY IF EXISTS write_back_audit_org_select ON public.write_back_audit;
CREATE POLICY write_back_audit_org_select ON public.write_back_audit
  FOR SELECT USING (public.is_org_member(org_id));
