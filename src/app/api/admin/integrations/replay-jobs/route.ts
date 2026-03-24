/**
 * Phase 3 — Admin: list replay jobs.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    await requireAnyOrgPermission("integrations.manage");
    const orgId = req.nextUrl.searchParams.get("orgId");
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 100);

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    let q = admin.from("integration_replay_jobs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (orgId) q = q.eq("org_id", orgId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, jobs: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
