/**
 * GET /api/integrations/jira/projects?orgId=
 * Returns Jira projects for the connected org.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { ensureValidJiraToken } from "@/services/jira/jiraAuthService";
import { jiraGet } from "@/lib/jira/client";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const { data: conn } = await admin
      .from("integration_connections")
      .select("status, config")
      .eq("org_id", ctx.orgId)
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

    const creds = await ensureValidJiraToken(admin, ctx.orgId);
    if (!creds) {
      return NextResponse.json(
        { error: "No valid Jira credentials" },
        { status: 400 }
      );
    }

    type ProjectSearchResponse = { values?: Array<{ id: string; key: string; name: string; projectTypeKey?: string }> };
    let raw: ProjectSearchResponse;
    try {
      raw = await jiraGet<ProjectSearchResponse>(
        c.config.cloudId,
        creds.accessToken,
        "/project/search?maxResults=100&orderBy=name"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch projects";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    const arr = raw?.values ?? [];

    const projects = arr.map((p: { id: string; key: string; name: string; projectTypeKey?: string }) => ({
      id: String(p.id),
      key: String(p.key),
      name: String(p.name),
      projectType: p.projectTypeKey ?? "software",
    }));

    return NextResponse.json({ projects });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
