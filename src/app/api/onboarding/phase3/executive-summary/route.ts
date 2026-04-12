import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase3AnalyticsBase } from "@/modules/onboarding/phase3/phase3-analytics-payload";
import { EXEC_SUMMARY_METRICS } from "@/modules/onboarding/phase3/phase3-constants";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { runPhase3Sync } from "@/modules/onboarding/phase3/phase3-sync.service";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

const ALLOWED_DAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

function isMetricKey(v: unknown): v is (typeof EXEC_SUMMARY_METRICS)[number] {
  return typeof v === "string" && (EXEC_SUMMARY_METRICS as readonly string[]).includes(v);
}

export async function PUT(req: NextRequest) {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, userId, orgId } = gate.ctx;

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (member as { role?: string } | null)?.role ?? null;
  if (!isAdminLikeRole(parseOrgRole(role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    enabled?: boolean;
    deliveryChannel?: string;
    destination?: string;
    scheduleDay?: string;
    scheduleTime?: string;
    timezone?: string;
    metrics?: unknown[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deliveryChannel = typeof body.deliveryChannel === "string" ? body.deliveryChannel.trim() : "";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const scheduleDay = typeof body.scheduleDay === "string" ? body.scheduleDay.trim().toLowerCase() : "";
  const scheduleTime = typeof body.scheduleTime === "string" ? body.scheduleTime.trim() : "";
  const timezone = typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "UTC";
  const enabled = body.enabled !== false;

  if (!deliveryChannel || !destination || !scheduleDay || !scheduleTime) {
    return NextResponse.json({ error: "deliveryChannel, destination, scheduleDay, scheduleTime required" }, { status: 400 });
  }
  if (!ALLOWED_DAYS.has(scheduleDay)) {
    return NextResponse.json({ error: "invalid_schedule_day" }, { status: 400 });
  }

  const metricsRaw = Array.isArray(body.metrics) ? body.metrics : [];
  const metrics = metricsRaw.filter(isMetricKey);
  const metricsJson = metrics;

  const admin = createAdminClient();

  await admin.from("org_executive_summary_preferences").delete().eq("org_id", orgId);

  const { data: inserted, error: insErr } = await admin
    .from("org_executive_summary_preferences")
    .insert({
      org_id: orgId,
      enabled,
      delivery_channel: deliveryChannel,
      destination,
      schedule_day: scheduleDay,
      schedule_time: scheduleTime,
      timezone,
      metrics: metricsJson,
    })
    .select("id")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await auditLog(admin, {
    orgId,
    actorId: userId,
    actorType: "USER",
    action: "onboarding_phase3_executive_summary_upserted",
    entityType: "org_executive_summary_preferences",
    entityId: inserted.id,
    metadata: { source: "phase3", deliveryChannel, scheduleDay, scheduleTime, timezone, metricCount: metricsJson.length },
  });

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase3_executive_summary_saved",
    properties: phase3AnalyticsBase(orgId, onboardRow?.phase3_status, onboardRow?.phase3_current_step),
  });

  await runPhase3Sync(orgId);

  return NextResponse.json({ ok: true, id: inserted.id });
}
