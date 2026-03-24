/**
 * Phase 2 Gap 2 — POST /api/admin/policies/[policyId]/deactivate.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPolicyById, updatePolicy } from "@/modules/policy/repositories/policies.repository";
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

    const { data: policy } = await getPolicyById(ctx.supabase, policyId);
    if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (
      String(policy.policy_owner_type ?? "").toUpperCase() === "PLATFORM" &&
      String(policy.relaxation_mode ?? "").toUpperCase() === "NON_RELAXABLE"
    ) {
      return NextResponse.json(
        { error: "Cannot deactivate a non-relaxable platform policy" },
        { status: 403 }
      );
    }

    const { data, error } = await updatePolicy(ctx.supabase, policyId, {
      status: "inactive",
      updated_by_user_id: ctx.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ policy: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
