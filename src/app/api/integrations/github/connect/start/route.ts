/**
 * POST /api/integrations/github/connect/start
 * Returns GitHub App installation URL for the connect flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { env } from "@/lib/env";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    if (!env.githubEnabled) {
      return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
    }

    let body: { organizationId?: string };
    try {
      body = (await req.json()) as { organizationId?: string };
    } catch {
      body = {};
    }
    const orgId = body.organizationId ?? req.nextUrl.searchParams.get("organizationId");

    if (!orgId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const state = randomBytes(32).toString("hex");

    await admin.from("github_connect_sessions").insert({
      state,
      org_id: ctx.orgId,
    });

    const appName = env.githubAppName ?? "Solvren";
    const installUrl = `https://github.com/apps/${encodeURIComponent(appName)}/installations/new?state=${state}`;

    return NextResponse.json({ installUrl });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
