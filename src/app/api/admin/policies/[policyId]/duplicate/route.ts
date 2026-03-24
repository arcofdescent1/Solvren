/**
 * Phase 2 Gap 2 — POST /api/admin/policies/[policyId]/duplicate.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPolicyById, duplicatePolicy } from "@/modules/policy/repositories/policies.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

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

    const { data: existing } = await getPolicyById(ctx.supabase, policyId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let body: { policyKey?: string; displayName?: string };
    try {
      body = await req.json().catch(() => ({}));
    } catch {
      body = {};
    }

    const policyKey = body.policyKey ?? `${existing.policy_key}_copy`;
    const displayName = body.displayName ?? `${existing.display_name} (copy)`;

    const { data, error } = await duplicatePolicy(ctx.supabase, policyId, {
      org_id: existing.org_id,
      policy_key: policyKey,
      display_name: displayName,
      created_by_user_id: ctx.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ policy: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
