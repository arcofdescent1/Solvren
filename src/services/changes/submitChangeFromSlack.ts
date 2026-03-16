import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runDeterministicRules,
  type ChangeIntake,
} from "@/services/risk/deterministicRules";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";

type Args = {
  orgId: string;
  createdByUserId: string;
  title: string;
  description?: string | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
  revenueSurface?: string | null;
  defaultChannelId?: string;
};

/**
 * Create change from Slack modal, run scoring, persist revenue, enqueue approvals.
 * Uses admin client; call from Slack actions route only.
 */
export async function submitChangeFromSlack(
  admin: SupabaseClient,
  args: Args
): Promise<{ changeId: string }> {
  const domain = "REVENUE";
  const changeType =
    args.revenueSurface === "PRICING"
      ? "PRICING"
      : args.revenueSurface === "BILLING"
        ? "BILLING"
        : "OTHER";

  const minimalIntake: ChangeIntake = {
    title: args.title,
    changeType,
    systemsInvolved: [],
    revenueImpactAreas: args.revenueSurface ? [args.revenueSurface] : [],
    impactsActiveCustomers: true,
    altersPricingVisibility: changeType === "PRICING",
    backfillRequired: false,
    dataMigrationRequired: false,
    requiresCodeDeploy: false,
    reversibleViaConfig: true,
    requiresDBRestore: false,
    requiresManualDataCorrection: false,
    rollbackTimeEstimateHours: 1,
    requestedReleaseAt: null,
    description: args.description ?? undefined,
  };

  const { data: change, error: ceErr } = await admin
    .from("change_events")
    .insert({
      org_id: args.orgId,
      title: args.title,
      change_type: changeType,
      status: "DRAFT",
      submitted_at: null,
      domain,
      intake: minimalIntake,
      systems_involved: minimalIntake.systemsInvolved,
      revenue_impact_areas: minimalIntake.revenueImpactAreas,
      impacts_active_customers: minimalIntake.impactsActiveCustomers,
      alters_pricing_visibility: minimalIntake.altersPricingVisibility,
      backfill_required: minimalIntake.backfillRequired,
      data_migration_required: minimalIntake.dataMigrationRequired,
      requires_code_deploy: minimalIntake.requiresCodeDeploy,
      reversible_via_config: minimalIntake.reversibleViaConfig,
      requires_db_restore: minimalIntake.requiresDBRestore,
      requires_manual_data_correction: minimalIntake.requiresManualDataCorrection,
      rollback_time_estimate_hours: minimalIntake.rollbackTimeEstimateHours ?? null,
      requested_release_at: null,
      created_by: args.createdByUserId,
      estimated_mrr_affected: args.estimatedMrrAffected ?? null,
      percent_customer_base_affected: args.percentCustomerBaseAffected ?? null,
      revenue_surface: args.revenueSurface ?? null,
    })
    .select("id")
    .single();

  if (ceErr || !change?.id) {
    throw new Error(ceErr?.message ?? "Failed to create change");
  }

  await addTimelineEvent({
    supabase: admin,
    orgId: args.orgId,
    changeEventId: change.id,
    actorUserId: args.createdByUserId,
    eventType: "CHANGE_CREATED",
    title: "Change created",
    description: `Change created from Slack`,
    metadata: { title: args.title },
  });

  const deterministic = runDeterministicRules(minimalIntake);
  if (deterministic.length > 0) {
    const { error: sigErr } = await admin.from("risk_signals").insert(
      deterministic.map((s) => ({
        change_event_id: change.id,
        domain,
        category: s.category,
        signal_key: s.key,
        value_type: s.value_type,
        value_bool: s.value_bool ?? null,
        value_num: s.value_num ?? null,
        confidence: s.confidence,
        reasons: s.reasons,
        source: "RULE",
        weight_at_time: 0,
        contribution: 0,
        created_by: args.createdByUserId,
      }))
    );
    if (sigErr) {
      throw new Error(sigErr.message);
    }
  }

  const { error: iaErr } = await admin.from("impact_assessments").insert({
    change_event_id: change.id,
    domain,
    status: "PENDING",
    schema_version: "pass_a_v1",
  });
  if (iaErr) throw new Error(iaErr.message);

  const { env } = await import("@/lib/env");
  const baseUrl = env.appUrl;
  const secret = env.cronSecret;
  if (!secret) throw new Error("CRON_SECRET not configured");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Internal-Secret": secret,
  };

  const computeRes = await fetch(`${baseUrl}/api/assessments/compute`, {
    method: "POST",
    headers,
    body: JSON.stringify({ changeEventId: change.id }),
  });
  if (!computeRes.ok) {
    const j = await computeRes.json().catch(() => ({}));
    throw new Error(
      (j as { error?: string })?.error ?? "Failed to compute assessment"
    );
  }

  const submitRes = await fetch(`${baseUrl}/api/changes/submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      changeEventId: change.id,
      createdByUserId: args.createdByUserId,
    }),
  });
  if (!submitRes.ok) {
    const j = await submitRes.json().catch(() => ({}));
    throw new Error(
      (j as { error?: string })?.error ?? "Failed to submit change"
    );
  }

  return { changeId: change.id };
}
