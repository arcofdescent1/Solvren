/**
 * GET /api/integrations/jira/statuses?orgId=
 * Returns Jira issue statuses for the connected org.
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

    let data: Array<{ id: string; name: string }>;
    try {
      data = (await jiraGet<Array<{ id: string; name: string }>>(
        c.config.cloudId,
        creds.accessToken,
        "/status"
      )) as Array<{ id: string; name: string }>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch statuses";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const statuses = Array.isArray(data)
      ? data.map((s) => ({ id: s.id, name: s.name }))
      : [];

    return NextResponse.json({ statuses });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
