/**
 * Phase 6 — Review workflow for governance rule suggestions (no direct production mutation).
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { getSuggestionById, updateSuggestionStatus } from "@/modules/learning/repositories/governance-suggestions.repository";
import { createDraftPolicyFromSuggestion } from "@/modules/learning/suggestions/suggestion-acceptance.service";

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
    const createPolicyDraft = b.createPolicyDraft !== false;

    const { data: suggestion, error: loadErr } = await getSuggestionById(ctx.supabase, id, ctx.orgId);
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

    let draftPolicyId: string | null = null;
    let draftSkippedReason: string | undefined;

    if (status === "ACCEPTED" && createPolicyDraft) {
      const draft = await createDraftPolicyFromSuggestion(ctx.supabase, ctx.orgId, suggestion, ctx.user.id);
      if (draft.error) {
        return NextResponse.json({ error: draft.error }, { status: 400 });
      }
      draftPolicyId = draft.draftPolicyId ?? null;
      draftSkippedReason = draft.skippedReason;
    }

    const { error } = await updateSuggestionStatus(ctx.supabase, id, ctx.orgId, {
      status,
      reviewed_by: ctx.user.id,
      review_rationale: reviewRationale,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      action: "governance_rule_suggestion_reviewed",
      entityType: "governance_rule_suggestion",
      entityId: id,
      metadata: {
        status,
        reviewRationale: reviewRationale || undefined,
        draftPolicyId: draftPolicyId || undefined,
        draftSkippedReason: draftSkippedReason || undefined,
      },
    });

    return NextResponse.json({ ok: true, draftPolicyId, draftSkippedReason });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
