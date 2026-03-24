/**
 * Phase 5 — GET /api/admin/impact/assumptions (§18.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { getEffectiveAssumptions, getEffectiveAssumptionsWithMetadata } from "@/modules/impact/persistence/org-impact-assumptions.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("domains.manage");

    const { searchParams } = new URL(req.url);
    const metadata = searchParams.get("metadata") === "true";

    if (metadata) {
      const assumptions = await getEffectiveAssumptionsWithMetadata(ctx.supabase, ctx.orgId);
      return NextResponse.json({ assumptions });
    }

    const assumptions = await getEffectiveAssumptions(ctx.supabase, ctx.orgId);
    const entries = Object.entries(assumptions).map(([key, value]) => ({
      key,
      value,
      valueType: typeof value,
    }));
    return NextResponse.json({ assumptions: entries });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
