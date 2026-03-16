/**
 * GET /api/integrations/jira/statuses?orgId=
 * Returns Jira issue statuses for the connected org.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureValidJiraToken } from "@/services/jira/jiraAuthService";
import { jiraGet } from "@/lib/jira/client";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: conn } = await admin
    .from("integration_connections")
    .select("status, config")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const c = conn as { status?: string; config?: { cloudId?: string } } | null;
  const isConnected = c?.status === "connected" || c?.status === "configured";
  if (!c || !isConnected || !c.config?.cloudId) {
    return NextResponse.json(
      { error: "Jira not connected. Connect Jira first." },
      { status: 400 }
    );
  }

  const creds = await ensureValidJiraToken(admin, orgId);
  if (!creds) {
    return NextResponse.json(
      { error: "No valid Jira credentials" },
      { status: 400 }
    );
  }

  try {
    const data = (await jiraGet<Array<{ id: string; name: string }>>(
      c.config.cloudId,
      creds.accessToken,
      "/status"
    )) as Array<{ id: string; name: string }>;

    const statuses = Array.isArray(data)
      ? data.map((s) => ({ id: s.id, name: s.name }))
      : [];

    return NextResponse.json({ statuses });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch statuses";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
