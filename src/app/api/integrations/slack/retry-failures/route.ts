import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const now = new Date().toISOString();
    const { data: updated } = await admin
      .from("slack_message_deliveries")
      .update({ next_retry_at: now, updated_at: now })
      .eq("org_id", ctx.orgId)
      .in("status", ["pending", "failed", "retrying"])
      .select("id");

    return NextResponse.json({ ok: true, queued: (updated ?? []).length });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
