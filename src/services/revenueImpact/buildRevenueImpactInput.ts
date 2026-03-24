import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHistoricalRiskSignals } from "./getHistoricalRiskSignals";
import type { RevenueImpactInput } from "./revenueImpactTypes";

function stableJsonHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean);
}

export function buildRevenueImpactInputHash(input: {
  title: string | null;
  description: string | null;
  changeType: string | null;
  domain: string | null;
  systems: string[];
  rolloutMethod: string | null;
  rollbackPlan: string | null;
  monitoringPlan: string | null;
  revenueImpactArea: string[];
  revenueExposureEstimate: number | null;
  backfillRequired: boolean | null;
  evidenceStatuses: Array<{ label: string; status: string; kind: string }>;
  approvers: string[];
  linkedIncidents: string[];
}): string {
  return stableJsonHash(input);
}

export async function buildRevenueImpactInput(args: {
  supabase: SupabaseClient;
  changeId: string;
}): Promise<RevenueImpactInput> {
  const { data: change, error: changeErr } = await scopeActiveChangeEvents(args.supabase.from("change_events").select("*"))
    .eq("id", args.changeId)
    .maybeSingle();

  if (changeErr) {
    throw new Error(changeErr.message);
  }
  if (!change) {
    throw new Error("Change not found");
  }

  const systems = asArray(change.systems_involved);
  const revenueImpactArea = asArray(change.revenue_impact_areas);

  const { data: evidenceItems } = await args.supabase
    .from("change_evidence_items")
    .select("label, kind, status")
    .eq("change_event_id", args.changeId);

  const { data: approvals } = await args.supabase
    .from("approvals")
    .select("approval_area, approver_user_id, decision")
    .eq("change_event_id", args.changeId);

  const { data: linkedIncidents } = await args.supabase
    .from("incidents")
    .select("id")
    .eq("change_event_id", args.changeId);

  const { data: org } = await args.supabase
    .from("organizations")
    .select("id, name")
    .eq("id", change.org_id)
    .maybeSingle();

  const { data: orgSettings } = await args.supabase
    .from("organization_settings")
    .select("*")
    .eq("org_id", change.org_id)
    .maybeSingle();

  const { data: approvalMappings } = await args.supabase
    .from("approval_role_map")
    .select("role_label, approval_area, domain_key")
    .eq("org_id", change.org_id)
    .limit(200);

  const historical = await getHistoricalRiskSignals({
    supabase: args.supabase,
    orgId: String(change.org_id),
    changeId: String(change.id),
    changeType: normalizeString(change.structured_change_type ?? change.change_type),
    domain: normalizeString(change.domain),
    systems,
    revenueImpactAreas: revenueImpactArea,
  });

  const evidence = (evidenceItems ?? []).map((e) => ({
    label: String(e.label ?? ""),
    kind: String(e.kind ?? "CUSTOM"),
    status: String(e.status ?? "UNKNOWN"),
  }));
  const approverRoles = Array.from(
    new Set((approvals ?? []).map((a) => String(a.approval_area ?? "")).filter(Boolean))
  );
  const linkedIncidentIds = (linkedIncidents ?? []).map((i) => String(i.id));

  const rollbackPlan = normalizeString((change.intake as Record<string, unknown> | null)?.rollbackPlan);
  const monitoringPlan = normalizeString((change.intake as Record<string, unknown> | null)?.monitoringPlan);
  const inputHash = buildRevenueImpactInputHash({
    title: normalizeString(change.title),
    description: normalizeString((change.intake as Record<string, unknown> | null)?.description ?? change.description),
    changeType: normalizeString(change.structured_change_type ?? change.change_type),
    domain: normalizeString(change.domain),
    systems,
    rolloutMethod: normalizeString(change.rollout_method),
    rollbackPlan,
    monitoringPlan,
    revenueImpactArea,
    revenueExposureEstimate:
      change.estimated_mrr_affected == null ? null : Number(change.estimated_mrr_affected),
    backfillRequired:
      typeof change.backfill_required === "boolean" ? Boolean(change.backfill_required) : null,
    evidenceStatuses: evidence,
    approvers: approverRoles,
    linkedIncidents: linkedIncidentIds,
  });

  return {
    inputHash,
    change: {
      id: String(change.id),
      orgId: String(change.org_id),
      title: normalizeString(change.title),
      description: normalizeString(
        (change.intake as Record<string, unknown> | null)?.description ?? change.description
      ),
      changeType: normalizeString(change.structured_change_type ?? change.change_type),
      domain: normalizeString(change.domain),
      systems,
      rolloutMethod: normalizeString(change.rollout_method),
      rollbackPlan,
      monitoringPlan,
      customerImpact:
        typeof change.customer_impact_expected === "boolean"
          ? Boolean(change.customer_impact_expected)
          : null,
      revenueImpactArea,
      revenueExposureEstimate:
        change.estimated_mrr_affected == null ? null : Number(change.estimated_mrr_affected),
      backfillRequired:
        typeof change.backfill_required === "boolean" ? Boolean(change.backfill_required) : null,
      approvers: approverRoles,
      evidenceItems: evidence,
      authorId: normalizeString(change.created_by),
      status: normalizeString(change.status),
      createdAt: normalizeString(change.created_at),
      submittedAt: normalizeString(change.submitted_at),
      customerSegments: asArray(change.affected_customer_segments),
      deploymentWindow: normalizeString((change.intake as Record<string, unknown> | null)?.deploymentWindow),
      dataBackfillDescription: normalizeString(
        (change.intake as Record<string, unknown> | null)?.dataBackfillDescription
      ),
      linkedSystems: asArray((change.intake as Record<string, unknown> | null)?.linkedSystems),
      implementationNotes: normalizeString(
        (change.intake as Record<string, unknown> | null)?.implementationNotes
      ),
      communicationPlan: normalizeString(
        (change.intake as Record<string, unknown> | null)?.communicationPlan
      ),
      expectedBusinessOutcome: normalizeString(
        (change.intake as Record<string, unknown> | null)?.expectedBusinessOutcome
      ),
    },
    organization: {
      orgName: normalizeString(org?.name),
      orgSettings: (orgSettings as Record<string, unknown> | null) ?? {},
      approvalMappings: (approvalMappings ?? []).map((m) => ({
        roleLabel: String(m.role_label ?? ""),
        approvalArea: String(m.approval_area ?? ""),
        domainKey: normalizeString(m.domain_key),
      })),
      domainSettings: {},
      systemCatalog: [],
    },
    historical,
  };
}
