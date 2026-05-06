import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recomputeOnboardingState,
  getOnboardingState,
  markFirstInsightsComplete,
  markPrivacyReviewComplete,
  ensureOnboardingStateRow,
} from "@/lib/onboarding/onboardingStateService";
import { runValueEngineBackfillOrg } from "@/lib/value-engine/runValueEngineCron";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { logProductEventAsync } from "@/lib/telemetry/productEvents";
import { retryWithBackoff, RETRY_PRESETS } from "@/lib/retry/retryWithBackoff";

async function activeOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return m?.org_id as string | undefined;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const orgId = await activeOrgId(supabase, u.user.id);
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

    const admin = createAdminClient();
    const step = await recomputeOnboardingState(admin, orgId);
    const state = await getOnboardingState(admin, orgId);

    const { count: integ } = await admin
      .from("integration_connections")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "connected")
      .in("provider", ["stripe", "hubspot", "salesforce"]);

    const nowIso = new Date().toISOString();
    const { data: topIssues } = await admin
      .from("issues")
      .select("id, title, revenue_impact_cents, priority_score, currency")
      .eq("org_id", orgId)
      .eq("source_type", "detector")
      .or(`suppressed_until.is.null,suppressed_until.lte.${nowIso}`)
      .order("priority_score", { ascending: false })
      .limit(3);

    const sum = (topIssues ?? []).reduce(
      (a, r) => a + Number((r as { revenue_impact_cents?: number }).revenue_impact_cents ?? 0),
      0
    );

    return NextResponse.json({
      ok: true,
      orgId,
      step,
      state,
      initialDetectionTriggered: Boolean(state?.initial_detection_triggered_at),
      connectedCount: integ ?? 0,
      topIssues: topIssues ?? [],
      projectedRevenueAtRiskCents: sum,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const supabase = await createServerSupabaseClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const orgId = await activeOrgId(supabase, u.user.id);
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

    await requireOrgPermission(orgId, "issues.view");

    const admin = createAdminClient();

    if (body.action === "trigger_detection") {
      await ensureOnboardingStateRow(admin, orgId);
      const { data: os } = await admin.from("onboarding_state").select("*").eq("org_id", orgId).maybeSingle();
      const triggered = (os as { initial_detection_triggered_at?: string | null } | null)
        ?.initial_detection_triggered_at;
      if (triggered) {
        await recomputeOnboardingState(admin, orgId);
        return NextResponse.json({ ok: true, skipped: true });
      }
      try {
        await retryWithBackoff(
          async () => {
            const r = await runValueEngineBackfillOrg(admin, orgId);
            if (!r.ok) throw new Error(r.errors.join("; ") || "value_engine_backfill_failed");
          },
          RETRY_PRESETS.integrationSync
        );
      } catch {
        return NextResponse.json({ ok: false, error: "value_engine_backfill_failed" }, { status: 502 });
      }
      await admin
        .from("onboarding_state")
        .update({ initial_detection_triggered_at: new Date().toISOString() })
        .eq("org_id", orgId);
      logProductEventAsync(admin, {
        event: "integration_sync",
        orgId,
        userId: u.user.id,
        metadata: {},
      });
      logProductEventAsync(admin, {
        event: "detection_run",
        orgId,
        userId: u.user.id,
        metadata: {},
      });
      await recomputeOnboardingState(admin, orgId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "advance_insights") {
      const r = await markFirstInsightsComplete(admin, orgId);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true, step: r.step });
    }

    if (body.action === "complete_privacy_review") {
      await requireOrgPermission(orgId, "org.settings.manage");
      const step = await markPrivacyReviewComplete(admin, orgId);
      return NextResponse.json({ ok: true, step });
    }

    await recomputeOnboardingState(admin, orgId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
