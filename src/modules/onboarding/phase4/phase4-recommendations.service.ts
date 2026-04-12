import type { SupabaseClient } from "@supabase/supabase-js";
import { planFromString } from "@/services/billing/entitlements";
import { phase4Thresholds } from "./phase4-thresholds";

export type Phase4Recommendation = {
  id: string;
  title: string;
  description: string;
  confidence: number;
  gapType: string;
};

async function getOrgPlanTier(supabase: SupabaseClient, orgId: string) {
  const { data } = await supabase.from("billing_accounts").select("plan_key").eq("org_id", orgId).maybeSingle();
  return planFromString((data as { plan_key?: string } | null)?.plan_key);
}

export async function buildPhase4ExpansionRecommendations(
  supabase: SupabaseClient,
  orgId: string
): Promise<Phase4Recommendation[]> {
  const plan = await getOrgPlanTier(supabase, orgId);
  const t = phase4Thresholds(plan);
  const out: Phase4Recommendation[] = [];

  const { data: intRows } = await supabase
    .from("integration_connections")
    .select("provider")
    .eq("org_id", orgId)
    .eq("status", "connected");
  const distinctIntegrations = new Set(
    (intRows ?? []).map((r) => String((r as { provider: string }).provider))
  ).size;

  if (distinctIntegrations < t.connectedIntegrations) {
    out.push({
      id: "missing_integration_depth",
      title: "Connect more integrations",
      description: `Enterprise maturity targets ${t.connectedIntegrations} connected integrations with distinct providers.`,
      confidence: 0.85,
      gapType: "missing_integration",
    });
  }

  const { count: wf } = await supabase
    .from("detector_configs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("enabled", true);
  if ((wf ?? 0) < t.enabledWorkflows) {
    out.push({
      id: "missing_workflow_depth",
      title: "Enable more workflows",
      description: `Targets ${t.enabledWorkflows} enabled detector workflows for cross-system orchestration.`,
      confidence: 0.82,
      gapType: "advanced_workflow_not_enabled",
    });
  }

  const { count: buQual } = await supabase
    .from("org_business_units")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if ((buQual ?? 0) < 1) {
    out.push({
      id: "missing_business_units",
      title: "Define business units or regions",
      description: "Add at least one business unit, region, subsidiary, or division and assign members.",
      confidence: 0.75,
      gapType: "missing_region",
    });
  }

  const { count: memBu } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("business_unit_id", "is", null);
  if ((memBu ?? 0) < 1 && (buQual ?? 0) > 0) {
    out.push({
      id: "assign_members_to_units",
      title: "Assign members to business units",
      description: "Expansion milestones require members attributed to each qualifying unit.",
      confidence: 0.78,
      gapType: "missing_department",
    });
  }

  return out;
}
