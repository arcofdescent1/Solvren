import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";
import { IntegrationConnectionService } from "@/modules/integrations";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { organizationId?: string };
  try {
    body = (await req.json()) as { organizationId?: string };
  } catch {
    body = {};
  }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const connSvc = new IntegrationConnectionService(admin);
  await connSvc.disconnectProvider(orgId, "jira");

  await auditLog(supabase, {
    orgId,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "jira_disconnected",
    entityType: "integration",
    entityId: "jira",
  });

  return NextResponse.json({ success: true });
}
