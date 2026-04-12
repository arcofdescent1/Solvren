import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole } from "@/lib/rbac/roles";
import { runPhase4Sync, computePhase4MilestoneFlags } from "@/modules/onboarding/phase4/phase4-sync.service";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { planFromString } from "@/services/billing/entitlements";
import { requirePhase4OrgContext } from "../_phase4Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase4OrgContext();
  if (!gate.ok) return gate.response;
  if (!isAdminLikeRole(gate.ctx.orgRole)) {
    return NextResponse.json({ error: "admin_required" }, { status: 403 });
  }

  const admin = createAdminClient();
  await runPhase4Sync(gate.ctx.orgId);
  const { data: fresh } = await getOrgOnboardingState(admin, gate.ctx.orgId);
  const { data: billing } = await admin.from("billing_accounts").select("plan_key").eq("org_id", gate.ctx.orgId).maybeSingle();
  const plan = planFromString((billing as { plan_key?: string } | null)?.plan_key);
  const milestones = computePhase4MilestoneFlags(fresh, plan);

  return NextResponse.json({
    renewalScore: fresh?.phase4_renewal_score ?? 0,
    expansionRecommendationCount: fresh?.phase4_expansion_recommendation_count ?? 0,
    milestones,
  });
}
