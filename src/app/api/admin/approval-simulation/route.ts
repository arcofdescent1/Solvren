/**
 * Phase A5 — Approval Simulation
 * Admins simulate required approvers before rollout.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { evaluateApprovalPolicies } from "@/lib/governance/ApprovalPolicyEngine";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getActiveOrg } from "@/lib/org/activeOrg";

type Body = {
  changeType?: string;
  impactAmount?: number;
  domain?: string;
  riskBucket?: string;
  riskCategory?: string;
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!membership?.orgId || !isAdminLikeRole(parseOrgRole(membership.role ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
}
