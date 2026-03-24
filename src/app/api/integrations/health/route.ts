/**
 * Gap 4 — GET /api/integrations/health (§14.3).
 * Integration health dashboard data.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");

    const { data: health, error } = await ctx.supabase
    .from("integration_health")
    .select("*")
    .eq("org_id", ctx.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    integrations: (health ?? []).map((h) => ({
      provider: h.provider,
      status: h.status,
      lastSuccess: h.last_success ?? undefined,
      lastFailure: h.last_failure ?? undefined,
      errorRate: h.error_rate ?? 0,
      avgLatencyMs: h.avg_latency_ms ?? undefined,
      updatedAt: h.updated_at,
    })),
  });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
