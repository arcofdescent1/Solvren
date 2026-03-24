-- Phase 3 — issue_jira_links: links Solvren issues to Jira issues created via execute action
-- (jira_issue_links links change_events; this table links issues)
CREATE TABLE IF NOT EXISTS public.issue_jira_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  jira_issue_key text NOT NULL,
  jira_issue_id text NOT NULL,
  jira_project_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_jira_links_issue ON public.issue_jira_links(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_jira_links_org ON public.issue_jira_links(org_id);
CREATE INDEX IF NOT EXISTS idx_issue_jira_links_jira_key ON public.issue_jira_links(jira_issue_key);

ALTER TABLE public.issue_jira_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS issue_jira_links_select ON public.issue_jira_links;
CREATE POLICY issue_jira_links_select ON public.issue_jira_links FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_jira_links_insert ON public.issue_jira_links;
CREATE POLICY issue_jira_links_insert ON public.issue_jira_links FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_jira_links_service ON public.issue_jira_links;
CREATE POLICY issue_jira_links_service ON public.issue_jira_links FOR ALL
  USING (auth.role() = 'service_role');
