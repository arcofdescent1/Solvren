/**
 * Phase 2 Gap 2 — POST /api/admin/policy-exceptions/[exceptionId]/deactivate.
 */
import { NextRequest, NextResponse } from "next/server";
import { updatePolicyException } from "@/modules/policy/repositories/policy-exceptions.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ exceptionId: string }> }
) {
  try {
    const { exceptionId } = await params;
    const ctx = await resolveResourceInOrg({
      table: "policy_exceptions",
      resourceId: exceptionId,
      permission: "policy.manage",
    });

    const { data, error } = await updatePolicyException(ctx.supabase, exceptionId, { status: "inactive" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ exception: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
