import { NextResponse } from "next/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { computeRevenueProtected } from "@/lib/outcomes/revenueProtected";
import type { ConfidenceLevel, OutcomeType } from "@/lib/outcomes/types";
import { isOutcomeType } from "@/lib/outcomes/types";
import { getRevenueAtRiskBasis } from "@/lib/outcomes/getRevenueAtRiskBasis";

/**
 * POST /api/outcomes/value-stories/[id]/verify — user verification (confidence → VERIFIED only).
 */
export async function POST(_req: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await routeContext.params;
    const admin = createPrivilegedClient("POST /api/outcomes/value-stories/[id]/verify");
    const { data: row } = await admin
      .from("value_stories")
      .select("org_id, status, outcome_type, change_event_id")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireOrgPermission((row as { org_id: string }).org_id, "change.approve");

    const st = String((row as { status?: string }).status ?? "");
    if (st === "REJECTED") {
      return NextResponse.json({ error: "Cannot verify a rejected story" }, { status: 400 });
    }

    const ot = String((row as { outcome_type?: string }).outcome_type ?? "");
    const changeId = (row as { change_event_id: string }).change_event_id;
    let estimated: number | undefined;
    if (
      isOutcomeType(ot) &&
      ot !== "READINESS_IMPROVED" &&
      ot !== "APPROVAL_TIME_SAVED"
    ) {
      const basis = await getRevenueAtRiskBasis(admin, changeId);
      estimated = computeRevenueProtected({
        estimatedMrrAffected: basis.monthlyValue ?? 0,
        impactDurationMonths: basis.assumedMonths,
        confidenceLevel: "VERIFIED" as ConfidenceLevel,
        outcomeType: ot as OutcomeType,
      });
    }

    const { error } = await admin
      .from("value_stories")
      .update({
        confidence_level: "VERIFIED",
        ...(estimated != null ? { estimated_value: estimated } : {}),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
