/**
 * GET /api/integrations/jira/projects?orgId=
 * Returns Jira projects for the connected org.
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
    type ProjectSearchResponse = { values?: Array<{ id: string; key: string; name: string; projectTypeKey?: string }> };
    const raw = await jiraGet<ProjectSearchResponse>(
      c.config.cloudId,
      creds.accessToken,
      "/project/search?maxResults=100&orderBy=name"
    );
    const arr = raw?.values ?? [];

    const projects = arr.map((p: { id: string; key: string; name: string; projectTypeKey?: string }) => ({
      id: String(p.id),
      key: String(p.key),
      name: String(p.name),
      projectType: p.projectTypeKey ?? "software",
    }));

    return NextResponse.json({ projects });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch projects";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
