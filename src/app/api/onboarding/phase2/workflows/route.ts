import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDetectorConfig, upsertDetectorConfig } from "@/modules/detection/persistence/detector-configs.repository";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { syncPhase2ProgressToOrgState } from "@/modules/onboarding/phase2/phase2-milestones.service";
import {
  WORKFLOW_SOURCE_TEMPLATE_KEYS,
  WORKFLOW_TEMPLATE_TO_DETECTOR_KEY,
  type WorkflowSourceTemplateKey,
} from "@/modules/onboarding/phase2/workflow-templates";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase2AnalyticsBase } from "@/modules/onboarding/phase2/phase2-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { requirePhase2OrgContext } from "../_phase2Context";

export const runtime = "nodejs";

function isTemplateKey(v: string): v is WorkflowSourceTemplateKey {
  return (WORKFLOW_SOURCE_TEMPLATE_KEYS as readonly string[]).includes(v);
}

export async function PUT(req: NextRequest) {
  const gate = await requirePhase2OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId, userId } = gate.ctx;

  let body: { workflows?: Array<{ sourceTemplateKey?: string; enabled?: boolean; thresholdOverrides?: Record<string, unknown> }> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const list = Array.isArray(body.workflows) ? body.workflows : [];
  if (list.length === 0) {
    return NextResponse.json({ error: "workflows array required" }, { status: 400 });
  }

  const admin = createAdminClient();
  for (const w of list) {
    const key = typeof w.sourceTemplateKey === "string" ? w.sourceTemplateKey.trim() : "";
    if (!isTemplateKey(key)) {
      return NextResponse.json({ error: `Invalid sourceTemplateKey: ${key}` }, { status: 400 });
    }
    const detectorKey = WORKFLOW_TEMPLATE_TO_DETECTOR_KEY[key];
    const { data: def, error: dErr } = await getDetectorDefinitionByKey(admin, detectorKey);
    if (dErr || !def) {
      return NextResponse.json({ error: `Detector not found for template ${key}` }, { status: 400 });
    }
    const enabled = Boolean(w.enabled);
    const { data: existing } = await getDetectorConfig(admin, orgId, def.id);
    const baseOverrides = (existing?.threshold_overrides_json ?? {}) as Record<string, unknown>;
    const merged = {
      ...baseOverrides,
      ...(w.thresholdOverrides && typeof w.thresholdOverrides === "object" ? w.thresholdOverrides : {}),
      source_template_key: key,
    };
    const { error } = await upsertDetectorConfig(admin, {
      org_id: orgId,
      detector_definition_id: def.id,
      enabled,
      threshold_overrides_json: merged,
      noise_control_overrides_json: existing?.noise_control_overrides_json ?? {},
      routing_overrides_json: existing?.routing_overrides_json ?? {},
      severity_override: existing?.severity_override ?? null,
      priority_override: existing?.priority_override ?? null,
      schedule_override_json: existing?.schedule_override_json ?? null,
      rollout_state: enabled ? "full" : "off",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await syncPhase2ProgressToOrgState(orgId);

  const enabledKeys = list.filter((w) => Boolean(w.enabled)).map((w) => String(w.sourceTemplateKey ?? ""));
  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase2_workflow_enabled",
    properties: {
      ...phase2AnalyticsBase(orgId, onboardRow?.phase2_status, onboardRow?.phase2_current_step),
      enabledTemplateCount: enabledKeys.length,
      enabledTemplateKeys: enabledKeys,
    },
  });

  return NextResponse.json({ ok: true });
}
