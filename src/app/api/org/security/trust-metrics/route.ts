import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { queryTrustMetricsForOrg } from "@/lib/server/trust/trust-metrics-query";

/**
 * GET /api/org/security/trust-metrics?orgId=&days=7
 * Bounded metrics from trust_compliance_events + write_back_audit only.
 */
export async function GET(req: NextRequest) {
  try {
    const orgIdParam = req.nextUrl.searchParams.get("orgId");
    if (!orgIdParam) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    const orgId = parseRequestedOrgId(orgIdParam);
    const ctx = await requireOrgPermission(orgId, "org.settings.view");
    const daysRaw = req.nextUrl.searchParams.get("days");
    const windowDays = daysRaw ? Math.min(Math.max(Number(daysRaw), 1), 90) : 7;

    const metrics = await queryTrustMetricsForOrg(ctx.supabase, orgId, windowDays);
    return NextResponse.json(metrics);
  } catch (e) {
    return authzErrorResponse(e);
  }
}
