/**
 * Phase A5 — Approval Simulation
 * Admins simulate required approvers before rollout.
 */
import { NextResponse } from "next/server";
import { evaluateApprovalPolicies } from "@/lib/governance/ApprovalPolicyEngine";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { hasPermissionInOrg } from "@/lib/rbac/can";
import { AuthzError, authzErrorResponse, requireVerifiedUser } from "@/lib/server/authz";

type Body = {
  changeType?: string;
  impactAmount?: number;
  domain?: string;
  riskBucket?: string;
  riskCategory?: string;
};

export async function POST(req: Request) {
  try {
    const session = await requireVerifiedUser();
    const supabase = session.supabase;

    const { activeOrgId, memberships } = await getActiveOrg(supabase, session.user.id);
    const membership = memberships.find((m) => m.orgId === activeOrgId);
    if (!membership?.orgId) throw new AuthzError(403, "Forbidden");

    const allowed = await hasPermissionInOrg(
      supabase,
      session.user.id,
      membership.orgId,
      "admin.simulations.manage"
    );
    if (!allowed) throw new AuthzError(403, "Forbidden");

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const context = {
      changeType: body.changeType,
      impactAmount: body.impactAmount,
      domain: body.domain ?? "REVENUE",
      riskBucket: body.riskBucket,
      riskCategory: body.riskCategory,
    };

    const requiredApprovers = await evaluateApprovalPolicies(
      supabase,
      membership.orgId,
      context
    );

    return NextResponse.json({
      ok: true,
      context,
      requiredApprovers: requiredApprovers.map((r) => ({
        role: r.role,
        minCount: r.minCount,
      })),
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
