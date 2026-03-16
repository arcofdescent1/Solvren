/**
 * V1 UI spec: /integrations route
 * Redirects to org settings integrations page.
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";

export default async function IntegrationsRedirectPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, data.user.id);
  const base = activeOrgId
    ? `/org/settings/integrations?orgId=${encodeURIComponent(activeOrgId)}`
    : "/org/settings/integrations";
  redirect(base);
}
