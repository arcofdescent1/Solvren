/**
 * Phase 2 Gap 2 — POST /api/admin/policies/[policyId]/archive.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPolicyById, archivePolicy } from "@/modules/policy/repositories/policies.repository";
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

    const { data, error } = await archivePolicy(ctx.supabase, policyId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ policy: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
