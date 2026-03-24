/**
 * Phase 5 — GET /api/admin/impact/assumptions/:assumptionKey/history (§18.2).
 */
import { NextResponse } from "next/server";
import { listAssumptionHistory } from "@/modules/impact/persistence/org-impact-assumptions.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assumptionKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("domains.manage");

    const { assumptionKey } = await params;
    const { data, error } = await listAssumptionHistory(ctx.supabase, ctx.orgId, assumptionKey);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      history: data.map((r) => ({
        id: r.id,
        assumptionKey: r.assumption_key,
        displayName: r.display_name,
        valueJson: r.value_json,
        valueType: r.value_type,
        source: r.source,
        effectiveFrom: r.effective_from,
        effectiveTo: r.effective_to,
        confidenceScore: r.confidence_score,
        notes: r.notes,
        updatedByUserId: r.updated_by_user_id,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
