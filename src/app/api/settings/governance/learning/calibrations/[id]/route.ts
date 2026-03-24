/**
 * Phase 6 — Review workflow for bounded calibration recommendations.
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { updateCalibrationRecommendationStatus } from "@/modules/learning/repositories/calibration-recommendations.repository";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const def = await resolveDefaultOrgForUser();
    const ctx = await requireOrgPermission(def.orgId, "policy.manage");
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const status = b.status;
    if (status !== "REVIEWED" && status !== "ACCEPTED" && status !== "REJECTED") {
      return NextResponse.json({ error: "status must be REVIEWED, ACCEPTED, or REJECTED" }, { status: 400 });
    }
    const reviewRationale = typeof b.reviewRationale === "string" ? b.reviewRationale.trim() : null;

    const { error } = await updateCalibrationRecommendationStatus(ctx.supabase, id, ctx.orgId, {
      status,
      reviewed_by: ctx.user.id,
      review_rationale: reviewRationale,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      action: "governance_calibration_recommendation_reviewed",
      entityType: "governance_calibration_recommendation",
      entityId: id,
      metadata: { status, reviewRationale: reviewRationale || undefined },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
