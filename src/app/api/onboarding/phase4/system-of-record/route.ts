import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLog } from "@/lib/audit";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { phase4AnalyticsBase } from "@/modules/onboarding/phase4/phase4-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { runPhase4Sync } from "@/modules/onboarding/phase4/phase4-sync.service";
import { isAdminLikeRole } from "@/lib/rbac/roles";
import { requirePhase4OrgContext } from "../_phase4Context";

export const runtime = "nodejs";

const SIGNAL_TYPES = new Set(["PRIMARY_DASHBOARD_SET", "QBR_REFERENCED", "CS_CONFIRMED_SYSTEM_OF_RECORD"]);

async function canPostCsSignal(admin: SupabaseClient, orgId: string, userId: string) {
  const { data: keys } = await admin
    .from("organization_member_roles")
    .select("role_key")
    .eq("org_id", orgId)
    .eq("user_id", userId);
  const set = new Set((keys ?? []).map((r) => String((r as { role_key: string }).role_key).toUpperCase()));
  return set.has("CUSTOMER_SUCCESS") || set.has("SUPER_ADMIN");
}

export async function POST(req: NextRequest) {
  const gate = await requirePhase4OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId, userId, orgRole } = gate.ctx;

  let body: { signalType?: string; signalValue?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const signalType = typeof body.signalType === "string" ? body.signalType.trim().toUpperCase() : "";
  const signalValue = typeof body.signalValue === "string" ? body.signalValue.trim() : null;
  if (!SIGNAL_TYPES.has(signalType)) {
    return NextResponse.json({ error: "invalid_signal_type" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (signalType === "PRIMARY_DASHBOARD_SET") {
    if (!isAdminLikeRole(orgRole)) return NextResponse.json({ error: "admin_required" }, { status: 403 });
    const { data: settingsRow } = await admin.from("organization_settings").select("org_id").eq("org_id", orgId).maybeSingle();
    const now = new Date().toISOString();
    if (settingsRow) {
      const { error: setErr } = await admin
        .from("organization_settings")
        .update({ primary_dashboard: "solvren", updated_at: now })
        .eq("org_id", orgId);
      if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 });
    } else {
      const { error: insErr } = await admin.from("organization_settings").insert({
        org_id: orgId,
        primary_dashboard: "solvren",
      });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    const { count: existingPrimary } = await admin
      .from("org_adoption_signals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("signal_type", "PRIMARY_DASHBOARD_SET");
    if ((existingPrimary ?? 0) === 0) {
      await admin.from("org_adoption_signals").insert({
        org_id: orgId,
        signal_type: "PRIMARY_DASHBOARD_SET",
        signal_value: signalValue,
        created_by: userId,
      });
    }
  } else if (signalType === "QBR_REFERENCED") {
    if (!isAdminLikeRole(orgRole)) return NextResponse.json({ error: "admin_required" }, { status: 403 });
    const { data: settingsRowQbr } = await admin.from("organization_settings").select("org_id").eq("org_id", orgId).maybeSingle();
    const nowQbr = new Date().toISOString();
    if (settingsRowQbr) {
      const { error: setErr } = await admin
        .from("organization_settings")
        .update({ executive_reporting_primary_source: true, updated_at: nowQbr })
        .eq("org_id", orgId);
      if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 });
    } else {
      const { error: insErr } = await admin.from("organization_settings").insert({
        org_id: orgId,
        executive_reporting_primary_source: true,
      });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    const { count: existingQbr } = await admin
      .from("org_adoption_signals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("signal_type", "QBR_REFERENCED");
    if ((existingQbr ?? 0) === 0) {
      await admin.from("org_adoption_signals").insert({
        org_id: orgId,
        signal_type: "QBR_REFERENCED",
        signal_value: signalValue,
        created_by: userId,
      });
    }
  } else if (signalType === "CS_CONFIRMED_SYSTEM_OF_RECORD") {
    if (!(await canPostCsSignal(admin, orgId, userId))) {
      return NextResponse.json({ error: "cs_or_super_admin_required" }, { status: 403 });
    }
    await admin.from("org_adoption_signals").insert({
      org_id: orgId,
      signal_type: "CS_CONFIRMED_SYSTEM_OF_RECORD",
      signal_value: signalValue,
      created_by: userId,
    });
    await auditLog(admin, {
      orgId,
      actorId: userId,
      actorType: "USER",
      action: "onboarding_phase4_cs_system_of_record_confirmed",
      entityType: "org_adoption_signals",
      entityId: null,
      metadata: { signalValue },
      required: true,
    });
  }

  await auditLog(admin, {
    orgId,
    actorId: userId,
    actorType: "USER",
    action: "onboarding_phase4_system_of_record_confirmed",
    entityType: "org_adoption_signals",
    entityId: null,
    metadata: { signalType, signalValue },
  });

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase4_system_of_record_confirmed",
    properties: {
      ...phase4AnalyticsBase(orgId, onboardRow?.phase4_status, onboardRow?.phase4_current_step),
      signalType,
    },
  });

  await runPhase4Sync(orgId);
  return NextResponse.json({ ok: true });
}
