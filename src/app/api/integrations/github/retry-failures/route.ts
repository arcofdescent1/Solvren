/**
 * POST /api/integrations/github/retry-failures
 * Queue retry of failed webhook events (processes github_webhook_events with error).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    if (!env.githubEnabled) {
      return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
    }

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const { data: failed } = await admin
      .from("github_webhook_events")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("processed", false)
      .not("error_message", "is", null)
      .limit(100);

    const ids = (failed ?? []).map((r) => (r as { id: string }).id);
    if (ids.length === 0) {
      return NextResponse.json({ queued: 0 });
    }

    await admin
      .from("github_webhook_events")
      .update({ error_message: null, error_code: null })
      .in("id", ids);

    return NextResponse.json({ queued: ids.length });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
