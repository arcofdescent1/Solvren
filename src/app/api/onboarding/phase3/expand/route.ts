import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { getDetectorConfig, upsertDetectorConfig } from "@/modules/detection/persistence/detector-configs.repository";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import {
  WORKFLOW_SOURCE_TEMPLATE_KEYS,
  WORKFLOW_TEMPLATE_TO_DETECTOR_KEY,
  type WorkflowSourceTemplateKey,
} from "@/modules/onboarding/phase2/workflow-templates";
import { phase3AnalyticsBase } from "@/modules/onboarding/phase3/phase3-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { runPhase3Sync } from "@/modules/onboarding/phase3/phase3-sync.service";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

const WORKFLOW_ALIASES: Record<string, WorkflowSourceTemplateKey> = {
  forecast_change_alert: "revenue_impacting_change",
};

function resolveWorkflowTemplateKey(raw: string): WorkflowSourceTemplateKey | null {
  const k = raw.trim();
  if ((WORKFLOW_SOURCE_TEMPLATE_KEYS as readonly string[]).includes(k)) return k as WorkflowSourceTemplateKey;
  const alias = WORKFLOW_ALIASES[k];
  return alias ?? null;
}

export async function POST(req: NextRequest) {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId, userId } = gate.ctx;

  let body: { type?: string; key?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const t = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!t || !key) return NextResponse.json({ error: "type and key required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: beforeRow } = await getOrgOnboardingState(admin, orgId);
  const expansionBefore = beforeRow?.expanded_integration_count ?? 0;

  if (t === "integration") {
    const provider = key.toLowerCase();
    const { data: conn } = await admin
      .from("integration_connections")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("provider", provider)
      .maybeSingle();
    const connected = conn && String((conn as { status?: string }).status ?? "").toLowerCase() === "connected";
    if (connected) {
      await runPhase3Sync(orgId);
      return NextResponse.json({ ok: true, alreadyCompleted: true, kind: "integration", key: provider });
    }

    await auditLog(admin, {
      orgId,
      actorId: userId,
      actorType: "USER",
      action: "onboarding_phase3_expand_requested",
      entityType: "onboarding",
      entityId: orgId,
      metadata: { source: "phase3", type: "integration", key: provider, connected: false },
    });

    await trackServerAppEvent(admin, {
      orgId,
      userId,
      event: "onboarding_phase3_expand",
      properties: { ...phase3AnalyticsBase(orgId, beforeRow?.phase3_status, beforeRow?.phase3_current_step), type: "integration", key: provider },
    });

    const connectHref = `/integrations/${encodeURIComponent(provider)}`;
    return NextResponse.json({
      ok: true,
      alreadyCompleted: false,
      kind: "integration",
      key: provider,
      mustConnect: true,
      connectHref,
    });
  }

  if (t === "workflow") {
    const templateKey = resolveWorkflowTemplateKey(key);
    if (!templateKey) {
      return NextResponse.json({ error: "unknown_workflow_key" }, { status: 400 });
    }
    const detectorKey = WORKFLOW_TEMPLATE_TO_DETECTOR_KEY[templateKey];
    const { data: def, error: dErr } = await getDetectorDefinitionByKey(admin, detectorKey);
    if (dErr || !def) return NextResponse.json({ error: "detector_not_found" }, { status: 400 });

    const { data: existing } = await getDetectorConfig(admin, orgId, def.id);
    if (existing?.enabled) {
      await runPhase3Sync(orgId);
      return NextResponse.json({ ok: true, alreadyCompleted: true, kind: "workflow", key: templateKey });
    }

    const baseOverrides = (existing?.threshold_overrides_json ?? {}) as Record<string, unknown>;
    const merged = { ...baseOverrides, source_template_key: templateKey };
    const { error } = await upsertDetectorConfig(admin, {
      org_id: orgId,
      detector_definition_id: def.id,
      enabled: true,
      threshold_overrides_json: merged,
      noise_control_overrides_json: existing?.noise_control_overrides_json ?? {},
      routing_overrides_json: existing?.routing_overrides_json ?? {},
      severity_override: existing?.severity_override ?? null,
      priority_override: existing?.priority_override ?? null,
      schedule_override_json: existing?.schedule_override_json ?? null,
      rollout_state: "full",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("org_phase3_usage_interactions").insert({
      org_id: orgId,
      user_id: userId,
      interaction_type: "workflow_configured",
      ref_type: "phase3_expand",
      ref_id: def.id,
    });

    await auditLog(admin, {
      orgId,
      actorId: userId,
      actorType: "USER",
      action: "onboarding_phase3_workflow_enabled",
      entityType: "detector_config",
      entityId: def.id,
      metadata: { source: "phase3", templateKey, detectorKey },
    });

    await trackServerAppEvent(admin, {
      orgId,
      userId,
      event: "onboarding_phase3_expand",
      properties: {
        ...phase3AnalyticsBase(orgId, beforeRow?.phase3_status, beforeRow?.phase3_current_step),
        type: "workflow",
        key: templateKey,
      },
    });

    await runPhase3Sync(orgId);
    const { data: afterRow } = await getOrgOnboardingState(admin, orgId);
    const expansionAfter = afterRow?.expanded_integration_count ?? 0;
    if (expansionBefore < 2 && expansionAfter >= 2) {
      await trackServerAppEvent(admin, {
        orgId,
        userId,
        event: "onboarding_phase3_expansion_completed",
        properties: phase3AnalyticsBase(orgId, afterRow?.phase3_status, afterRow?.phase3_current_step),
      });
    }

    return NextResponse.json({ ok: true, alreadyCompleted: false, kind: "workflow", key: templateKey });
  }

  return NextResponse.json({ error: "invalid_type" }, { status: 400 });
}
