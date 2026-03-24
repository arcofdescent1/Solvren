/**
 * Phase 3 — GET/POST /api/admin/policies/[policyId]/exceptions.
 * Phase 2 Gap 2 — GET exceptions.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPolicyById } from "@/modules/policy/repositories/policies.repository";
import { listExceptionsByPolicyId, insertPolicyException } from "@/modules/policy/repositories/policy-exceptions.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const { policyId } = await params;
    const ctx = await resolveResourceInOrg({
      table: "policies",
      resourceId: policyId,
      permission: "policy.manage",
    });

    const { data: policy } = await getPolicyById(ctx.supabase, policyId);
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

    const { data, error } = await listExceptionsByPolicyId(ctx.supabase, policyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ exceptions: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const { policyId } = await params;
    const ctx = await resolveResourceInOrg({
      table: "policies",
      resourceId: policyId,
      permission: "policy.manage",
    });

    const { data: policy } = await getPolicyById(ctx.supabase, policyId);
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

    const orgId = policy.org_id;
    if (!orgId) return NextResponse.json({ error: "Global policies cannot have org exceptions" }, { status: 400 });

    let body: {
      scope?: Record<string, unknown>;
      overrideEffect?: Record<string, unknown>;
      reason?: string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.reason || !body.effectiveFrom || !body.overrideEffect) {
      return NextResponse.json({ error: "reason, effectiveFrom, overrideEffect required" }, { status: 400 });
    }

    const { data, error } = await insertPolicyException(ctx.supabase, {
      org_id: orgId,
      policy_id: policyId,
      scope_json: body.scope ?? {},
      override_effect_json: body.overrideEffect,
      reason: body.reason,
      approved_by_user_id: ctx.user.id,
      effective_from: body.effectiveFrom,
      effective_to: body.effectiveTo ?? null,
      status: "active",
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ exception: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
