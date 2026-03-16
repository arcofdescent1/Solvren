-- RLS for approval_role_map (reference data, read by authenticated)
ALTER TABLE public.approval_role_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_role_map_select ON public.approval_role_map;
CREATE POLICY approval_role_map_select ON public.approval_role_map
  FOR SELECT TO authenticated USING (true);

-- RLS for change_approval_requirements (read by org members)
ALTER TABLE public.change_approval_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS change_approval_requirements_select ON public.change_approval_requirements;
CREATE POLICY change_approval_requirements_select ON public.change_approval_requirements
  FOR SELECT USING (is_org_member(org_id));
