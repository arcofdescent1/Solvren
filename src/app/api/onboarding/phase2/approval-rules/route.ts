import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertPolicy, getPolicyByKey } from "@/modules/policy/repositories/policies.repository";
import { validatePolicyDraft } from "@/modules/policy/services/policy-validation.service";
import {
  getOrgOnboardingState,
  upsertOrgOnboardingState,
} from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import {
  countActivationPolicies,
  syncPhase2ProgressToOrgState,
} from "@/modules/onboarding/phase2/phase2-milestones.service";
import {
  ACTIVATION_POLICY_TEMPLATES,
  type ActivationPolicyTemplateKey,
} from "@/modules/onboarding/phase2/policy-templates";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase2AnalyticsBase } from "@/modules/onboarding/phase2/phase2-analytics-payload";
import { requirePhase2OrgContext } from "../_phase2Context";

export const runtime = "nodejs";

function isActivationTemplateKey(v: string): v is ActivationPolicyTemplateKey {
  return v in ACTIVATION_POLICY_TEMPLATES;
}

export async function PUT(req: NextRequest) {
  const gate = await requirePhase2OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, userId, orgId } = gate.ctx;

  let body: { templates?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const keys = Array.isArray(body.templates) ? body.templates : [];
  if (keys.length < 1 || keys.length > 3) {
    return NextResponse.json({ error: "Provide 1–3 policy templates." }, { status: 400 });
  }

  const admin = createAdminClient();
  let created = 0;

  for (const k of keys) {
    if (typeof k !== "string" || !isActivationTemplateKey(k)) {
      return NextResponse.json({ error: `Invalid template: ${k}` }, { status: 400 });
    }
    const tpl = ACTIVATION_POLICY_TEMPLATES[k];
    const { data: existing } = await getPolicyByKey(admin, orgId, tpl.policyKey);
    if (existing) continue;

    const validation = validatePolicyDraft({
      displayName: tpl.displayName,
      policyKey: tpl.policyKey,
      scope: "action",
      scopeRef: null,
      defaultDisposition: "ALLOW",
      rules: tpl.rules,
    });
    if (!validation.valid) {
      return NextResponse.json({ error: "Policy validation failed", errors: validation.errors }, { status: 400 });
    }

    const { error } = await insertPolicy(admin, {
      org_id: orgId,
      policy_key: tpl.policyKey,
      display_name: tpl.displayName,
      description: tpl.description,
      scope: "action",
      scope_ref: null,
      priority_order: 100,
      status: "active",
      default_disposition: "ALLOW",
      rules_json: tpl.rules,
      created_by_user_id: userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    created += 1;
  }

  const policiesN = await countActivationPolicies(admin, orgId);
  if (policiesN < 1) {
    return NextResponse.json({ error: "At least one activation policy must be active." }, { status: 400 });
  }

  await upsertOrgOnboardingState(supabase, {
    orgId,
    phase2Status: "WAITING_FOR_EVENT",
    phase2CurrentStep: "first_live_result",
  });
  await syncPhase2ProgressToOrgState(orgId);

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase2_approval_rule_created",
    properties: {
      ...phase2AnalyticsBase(orgId, onboardRow?.phase2_status, onboardRow?.phase2_current_step),
      policiesCreated: created,
      templateKeys: keys.filter(isActivationTemplateKey),
    },
  });

  return NextResponse.json({ ok: true, policiesCreated: created });
}
