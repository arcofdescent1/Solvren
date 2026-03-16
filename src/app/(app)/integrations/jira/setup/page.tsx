/**
 * V1 UI spec: /integrations/jira/setup
 * Redirects to org settings Jira setup.
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";

export default async function IntegrationsJiraSetupRedirectPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, data.user.id);
  const q = activeOrgId ? `?orgId=${encodeURIComponent(activeOrgId)}` : "";
  redirect(`/org/settings/integrations/jira/setup${q}`);
}
