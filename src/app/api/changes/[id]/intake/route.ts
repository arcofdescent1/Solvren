import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { resolveApprovalRoleSuggestions } from "@/services/approvals/roleMapping";
import { validateChange } from "@/services/changeValidation";
import { markRevenueImpactStale } from "@/services/revenueImpact/markRevenueImpactStale";
import { runRevenueImpactGeneration } from "@/services/revenueImpact/runRevenueImpactGeneration";
import { markCoordinationPlanStale } from "@/services/coordination/markCoordinationPlanStale";
import { runCoordinationPlanGeneration } from "@/services/coordination/runCoordinationPlanGeneration";

type Body = {
  title?: string;
  changeType?: string | null;
  structuredChangeType?: string | null;
  domain?: string | null;
  systemsInvolved?: string[];
  revenueImpactAreas?: string[];
  rolloutMethod?: string | null;
  plannedReleaseAt?: string | null;
  rollbackTimeEstimateHours?: number | null;
  backfillRequired?: boolean | null;
  customerImpactExpected?: boolean | null;
  affectedCustomerSegments?: string[] | null;
  revenueSurface?: string | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
  description?: string | null;
  impactsActiveCustomers?: boolean;
  altersPricingVisibility?: boolean;
  dataMigrationRequired?: boolean;
  requiresCodeDeploy?: boolean;
  reversibleViaConfig?: boolean;
  requiresDBRestore?: boolean;
  requiresManualDataCorrection?: boolean;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: change, error: ceErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, status, intake"))
    .eq("id", id)
    .single();

  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Change not found" },
      { status: 404 }
    );

  const status = (change.status ?? "DRAFT") as string;
  if (status !== "DRAFT" && status !== "READY") {
    return NextResponse.json(
      { error: "Only draft or ready changes can be updated" },
      { status: 400 }
    );
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );

  const patch: Record<string, unknown> = {};

  if (body.title !== undefined)
    patch.title = (body.title?.trim() || "Untitled change").slice(0, 500);
  if (body.changeType !== undefined)
    patch.change_type = body.changeType || "OTHER";
  if (body.structuredChangeType !== undefined)
    patch.structured_change_type = body.structuredChangeType ?? null;
  if (body.domain !== undefined)
    patch.domain = body.domain ?? "REVENUE";
  if (body.systemsInvolved !== undefined)
    patch.systems_involved = Array.isArray(body.systemsInvolved)
      ? body.systemsInvolved
      : [];
  if (body.revenueImpactAreas !== undefined)
    patch.revenue_impact_areas = Array.isArray(body.revenueImpactAreas)
      ? body.revenueImpactAreas
      : [];
  if (body.rolloutMethod !== undefined)
    patch.rollout_method = body.rolloutMethod ?? null;
  if (body.plannedReleaseAt !== undefined) {
    const val = body.plannedReleaseAt
      ? new Date(body.plannedReleaseAt).toISOString()
      : null;
    patch.planned_release_at = val;
    patch.requested_release_at = val;
  }
  if (body.rollbackTimeEstimateHours !== undefined)
    patch.rollback_time_estimate_hours =
      body.rollbackTimeEstimateHours != null
        ? Number(body.rollbackTimeEstimateHours)
        : null;
  if (body.backfillRequired !== undefined)
    patch.backfill_required = body.backfillRequired ?? false;
  if (body.customerImpactExpected !== undefined)
    patch.customer_impact_expected = body.customerImpactExpected ?? false;
  if (body.affectedCustomerSegments !== undefined)
    patch.affected_customer_segments =
      Array.isArray(body.affectedCustomerSegments) &&
      body.affectedCustomerSegments.length > 0
        ? body.affectedCustomerSegments
        : null;
  if (body.revenueSurface !== undefined)
    patch.revenue_surface = body.revenueSurface?.trim() || null;
  if (body.estimatedMrrAffected !== undefined)
    patch.estimated_mrr_affected =
      body.estimatedMrrAffected != null ? Number(body.estimatedMrrAffected) : null;
  if (body.percentCustomerBaseAffected !== undefined)
    patch.percent_customer_base_affected =
      body.percentCustomerBaseAffected != null
        ? Number(body.percentCustomerBaseAffected)
        : null;

  if (body.impactsActiveCustomers !== undefined)
    patch.impacts_active_customers = body.impactsActiveCustomers ?? false;
  if (body.altersPricingVisibility !== undefined)
    patch.alters_pricing_visibility = body.altersPricingVisibility ?? false;
  if (body.dataMigrationRequired !== undefined)
    patch.data_migration_required = body.dataMigrationRequired ?? false;
  if (body.requiresCodeDeploy !== undefined)
    patch.requires_code_deploy = body.requiresCodeDeploy ?? false;
  if (body.reversibleViaConfig !== undefined)
    patch.reversible_via_config = body.reversibleViaConfig ?? false;
  if (body.requiresDBRestore !== undefined)
    patch.requires_db_restore = body.requiresDBRestore ?? false;
  if (body.requiresManualDataCorrection !== undefined)
    patch.requires_manual_data_correction =
      body.requiresManualDataCorrection ?? false;

  if (body.description !== undefined) {
    const intake =
      (change as { intake?: Record<string, unknown> }).intake ?? {};
    patch.intake = {
      ...(typeof intake === "object" ? intake : {}),
      description: body.description ?? "",
    };
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ ok: true });

  if (
    patch.percent_customer_base_affected != null &&
    (Number(patch.percent_customer_base_affected) < 0 ||
      Number(patch.percent_customer_base_affected) > 100)
  ) {
    return NextResponse.json(
      { error: "percentCustomerBaseAffected must be 0–100" },
      { status: 400 }
    );
  }
  if (
    patch.estimated_mrr_affected != null &&
    Number(patch.estimated_mrr_affected) < 0
  ) {
    return NextResponse.json(
      { error: "estimatedMrrAffected must be non-negative" },
      { status: 400 }
    );
  }

  const { error: updErr } = await supabase
    .from("change_events")
    .update(patch)
    .eq("id", id);

  if (updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 });

  await auditLog(supabase, {
    orgId: String(change.org_id),
    actorId: userRes.user.id,
    action: "change_intake_updated",
    entityType: "change",
    entityId: id,
    metadata: { fields: Object.keys(patch) },
  });

  const materialImpactFields = new Set([
    "title",
    "change_type",
    "structured_change_type",
    "domain",
    "systems_involved",
    "rollout_method",
    "backfill_required",
    "estimated_mrr_affected",
    "revenue_impact_areas",
    "customer_impact_expected",
    "affected_customer_segments",
    "intake",
  ]);
  const touchedMaterial = Object.keys(patch).some((k) => materialImpactFields.has(k));
  if (touchedMaterial) {
    await markRevenueImpactStale({
      supabase,
      orgId: String(change.org_id),
      changeId: id,
      actorUserId: userRes.user.id,
      reason: "Material intake fields changed",
    });
    await markCoordinationPlanStale({
      supabase,
      orgId: String(change.org_id),
      changeId: id,
      actorUserId: userRes.user.id,
      reason: "Material intake fields changed",
    });
  }

  // Re-evaluate approval mapping suggestions when trigger fields change.
  const triggerFields = new Set([
    "domain",
    "systems_involved",
    "change_type",
    "structured_change_type",
  ]);
  const touchedTriggerField = Object.keys(patch).some((k) => triggerFields.has(k));
  if (touchedTriggerField) {
    try {
      const admin = createAdminClient();
      const { data: updated } = await admin
        .from("change_events")
        .select("domain, systems_involved, change_type, structured_change_type")
        .eq("id", id)
        .single();
      if (updated) {
        const resolved = await resolveApprovalRoleSuggestions(admin, {
          orgId: String(change.org_id),
          domain: String(updated.domain ?? "REVENUE"),
          systems: Array.isArray(updated.systems_involved)
            ? (updated.systems_involved as string[])
            : [],
          changeType:
            String(
              updated.structured_change_type ?? updated.change_type ?? ""
            ) || null,
        });
        await auditLog(supabase, {
          orgId: String(change.org_id),
          actorId: userRes.user.id,
          action: "approval_mapping_evaluated",
          entityType: "change",
          entityId: id,
          metadata: {
            suggested_roles: resolved.suggestions.map((s) => s.roleName),
            suggested_users: resolved.suggestedUserIds.length,
            warnings: resolved.warnings,
          },
        });
      }
    } catch {
      // best effort
    }
  }

  // Keep READY lifecycle in sync with validation and auto-generate first report when entering READY.
  try {
    const validation = await validateChange({
      changeId: id,
      supabase,
      requireAssessment: true,
    });
    const { data: currentRow } = await scopeActiveChangeEvents(supabase.from("change_events").select("status"))
      .eq("id", id)
      .single();
    const currentStatus = String(currentRow?.status ?? "DRAFT");
    if (validation.ready && currentStatus === "DRAFT") {
      await supabase
        .from("change_events")
        .update({ status: "READY", ready_at: new Date().toISOString() })
        .eq("id", id);
      try {
        await runRevenueImpactGeneration({
          supabase,
          orgId: String(change.org_id),
          changeId: id,
          actorUserId: userRes.user.id,
          regenerate: false,
        });
      } catch {
        // Non-fatal for intake saves.
      }
      try {
        await runCoordinationPlanGeneration({
          supabase,
          orgId: String(change.org_id),
          changeId: id,
          actorUserId: userRes.user.id,
          regenerate: false,
        });
      } catch {
        // Non-fatal for intake saves.
      }
    }
  } catch {
    // Readiness updates are best effort.
  }

  return NextResponse.json({ ok: true });
}
