-- Phase 0: RLS for issues and related tables (org-scoped, consistent with org member/role logic)

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_issue_links ENABLE ROW LEVEL SECURITY;

-- issues: org members can select/insert/update
DROP POLICY IF EXISTS issues_select ON public.issues;
CREATE POLICY issues_select ON public.issues FOR SELECT USING (is_org_member(org_id));
DROP POLICY IF EXISTS issues_insert ON public.issues;
CREATE POLICY issues_insert ON public.issues FOR INSERT WITH CHECK (is_org_member(org_id));
DROP POLICY IF EXISTS issues_update ON public.issues;
CREATE POLICY issues_update ON public.issues FOR UPDATE USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

-- issue_sources: visible when issue is visible
DROP POLICY IF EXISTS issue_sources_select ON public.issue_sources;
CREATE POLICY issue_sources_select ON public.issue_sources FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_sources.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS issue_sources_insert ON public.issue_sources;
CREATE POLICY issue_sources_insert ON public.issue_sources FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_sources.issue_id AND is_org_member(i.org_id)));

-- issue_entities
DROP POLICY IF EXISTS issue_entities_select ON public.issue_entities;
CREATE POLICY issue_entities_select ON public.issue_entities FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_entities.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS issue_entities_insert ON public.issue_entities;
CREATE POLICY issue_entities_insert ON public.issue_entities FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_entities.issue_id AND is_org_member(i.org_id)));

-- issue_history
DROP POLICY IF EXISTS issue_history_select ON public.issue_history;
CREATE POLICY issue_history_select ON public.issue_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_history.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS issue_history_insert ON public.issue_history;
CREATE POLICY issue_history_insert ON public.issue_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_history.issue_id AND is_org_member(i.org_id)));

-- issue_actions
DROP POLICY IF EXISTS issue_actions_select ON public.issue_actions;
CREATE POLICY issue_actions_select ON public.issue_actions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_actions.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS issue_actions_insert ON public.issue_actions;
CREATE POLICY issue_actions_insert ON public.issue_actions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_actions.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS issue_actions_update ON public.issue_actions;
CREATE POLICY issue_actions_update ON public.issue_actions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_actions.issue_id AND is_org_member(i.org_id)));

-- issue_comments
DROP POLICY IF EXISTS issue_comments_select ON public.issue_comments;
CREATE POLICY issue_comments_select ON public.issue_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_comments.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS issue_comments_insert ON public.issue_comments;
CREATE POLICY issue_comments_insert ON public.issue_comments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_comments.issue_id AND is_org_member(i.org_id)));

-- verification_runs, verification_evidence
DROP POLICY IF EXISTS verification_runs_select ON public.verification_runs;
CREATE POLICY verification_runs_select ON public.verification_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = verification_runs.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS verification_runs_insert ON public.verification_runs;
CREATE POLICY verification_runs_insert ON public.verification_runs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = verification_runs.issue_id AND is_org_member(i.org_id)));

DROP POLICY IF EXISTS verification_evidence_select ON public.verification_evidence;
CREATE POLICY verification_evidence_select ON public.verification_evidence FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.verification_runs vr JOIN public.issues i ON i.id = vr.issue_id WHERE vr.id = verification_evidence.verification_run_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS verification_evidence_insert ON public.verification_evidence;
CREATE POLICY verification_evidence_insert ON public.verification_evidence FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.verification_runs vr JOIN public.issues i ON i.id = vr.issue_id WHERE vr.id = verification_evidence.verification_run_id AND is_org_member(i.org_id)));

-- issue_impact_assessments
DROP POLICY IF EXISTS issue_impact_assessments_select ON public.issue_impact_assessments;
CREATE POLICY issue_impact_assessments_select ON public.issue_impact_assessments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_impact_assessments.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS issue_impact_assessments_insert ON public.issue_impact_assessments;
CREATE POLICY issue_impact_assessments_insert ON public.issue_impact_assessments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_impact_assessments.issue_id AND is_org_member(i.org_id)));

-- routing_rules: org-scoped
DROP POLICY IF EXISTS routing_rules_select ON public.routing_rules;
CREATE POLICY routing_rules_select ON public.routing_rules FOR SELECT USING (is_org_member(org_id));
DROP POLICY IF EXISTS routing_rules_insert ON public.routing_rules;
CREATE POLICY routing_rules_insert ON public.routing_rules FOR INSERT WITH CHECK (is_org_member(org_id));
DROP POLICY IF EXISTS routing_rules_update ON public.routing_rules;
CREATE POLICY routing_rules_update ON public.routing_rules FOR UPDATE USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

-- execution_tasks
DROP POLICY IF EXISTS execution_tasks_select ON public.execution_tasks;
CREATE POLICY execution_tasks_select ON public.execution_tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = execution_tasks.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS execution_tasks_insert ON public.execution_tasks;
CREATE POLICY execution_tasks_insert ON public.execution_tasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = execution_tasks.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS execution_tasks_update ON public.execution_tasks;
CREATE POLICY execution_tasks_update ON public.execution_tasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = execution_tasks.issue_id AND is_org_member(i.org_id)));

-- change_issue_links: visible when user can see the issue
DROP POLICY IF EXISTS change_issue_links_select ON public.change_issue_links;
CREATE POLICY change_issue_links_select ON public.change_issue_links FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = change_issue_links.issue_id AND is_org_member(i.org_id)));
DROP POLICY IF EXISTS change_issue_links_insert ON public.change_issue_links;
CREATE POLICY change_issue_links_insert ON public.change_issue_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = change_issue_links.issue_id AND is_org_member(i.org_id)));
