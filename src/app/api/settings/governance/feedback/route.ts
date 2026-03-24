/**
 * Phase 6 — Explicit governance decision labels (human feedback).
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { ingestExplicitLabel } from "@/modules/learning/labels/label-ingest.service";

export async function POST(req: Request) {
  try {
    const def = await resolveDefaultOrgForUser();
    const ctx = await requireOrgPermission(def.orgId, "policy.manage");

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
    const traceId = typeof b.traceId === "string" ? b.traceId.trim() : "";
    const labelType = typeof b.labelType === "string" ? b.labelType.trim() : "";
    const rationale = typeof b.rationale === "string" ? b.rationale.trim() : null;

    if (!traceId || !labelType) {
      return NextResponse.json({ error: "traceId and labelType are required" }, { status: 400 });
    }

    const result = await ingestExplicitLabel(ctx.supabase, {
      traceId,
      orgId: ctx.orgId,
      labelType,
      actorUserId: ctx.user.id,
      rationale: rationale || null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Label ingest failed" }, { status: 400 });
    }

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      action: "governance_decision_label_created",
      entityType: "policy_decision_log",
      entityId: traceId,
      metadata: { labelType, rationale: rationale || undefined },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
