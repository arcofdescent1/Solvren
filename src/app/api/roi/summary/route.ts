import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canViewRoiDashboard } from "@/lib/issues/verification/canViewRoiDashboard";
import { recomputeOnboardingState, getOnboardingState } from "@/lib/onboarding/onboardingStateService";

/** Phase 4 — ROI aggregates for executive dashboard (month-to-date, UTC month boundaries). */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const orgId = membership?.org_id as string | undefined;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const ok = await canViewRoiDashboard(supabase, userId, orgId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  await recomputeOnboardingState(admin, orgId);
  const os = await getOnboardingState(admin, orgId);
  if ((os?.current_step ?? "") !== "COMPLETE") {
    return NextResponse.json({ error: "onboarding_required" }, { status: 403 });
  }

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const { data: events } = await supabase
    .from("roi_events")
    .select("roi_type, actual_value_cents, estimated_value_cents, confidence, explanation, created_at, issue_id")
    .eq("org_id", orgId)
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  let recovered = 0;
  let prevented = 0;
  let efficiency = 0;
  for (const e of events ?? []) {
    const r = e as { roi_type?: string; actual_value_cents?: number | null };
    const v = Number(r.actual_value_cents ?? 0) || 0;
    if (r.roi_type === "recovered_revenue") recovered += v;
    else if (r.roi_type === "prevented_loss") prevented += v;
    else if (r.roi_type === "efficiency_gain") efficiency += v;
  }

  const { count: verifiedIssueCount } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("verification_status", "passed");

  const { count: pendingVerificationCount } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "resolved")
    .eq("verification_status", "pending");

  return NextResponse.json({
    ok: true,
    monthStartUtc: start.toISOString(),
    totalsCents: {
      recoveredRevenue: recovered,
      preventedLoss: prevented,
      efficiencyGain: efficiency,
    },
    recentRoiEvents: events ?? [],
    counts: {
      issuesOutcomePassed: verifiedIssueCount ?? 0,
      issuesPendingVerification: pendingVerificationCount ?? 0,
    },
  });
}
