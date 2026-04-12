/**
 * Guided Phase 1 — org_onboarding_scan_runs repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgOnboardingScanRunRow = {
  id: string;
  org_id: string;
  status: string;
  source_mode: string;
  selected_use_cases: unknown[];
  connected_integrations: unknown[];
  findings: Record<string, unknown> | null;
  estimated_revenue_at_risk: string | number | null;
  issue_count: number | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function insertScanRun(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    userId: string;
    selectedUseCases: string[];
    connectedIntegrations: string[];
    status?: string;
    sourceMode?: string;
  }
): Promise<{ data: OrgOnboardingScanRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_onboarding_scan_runs")
    .insert({
      org_id: input.orgId,
      created_by: input.userId,
      status: input.status ?? "QUEUED",
      source_mode: input.sourceMode ?? "REAL",
      selected_use_cases: input.selectedUseCases,
      connected_integrations: input.connectedIntegrations,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data: data as OrgOnboardingScanRunRow | null, error: error as Error | null };
}

export async function getScanRunById(
  supabase: SupabaseClient,
  id: string,
  orgId: string
): Promise<{ data: OrgOnboardingScanRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_onboarding_scan_runs")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return { data: data as OrgOnboardingScanRunRow | null, error: error as Error | null };
}

export async function findActiveScanRunForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrgOnboardingScanRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_onboarding_scan_runs")
    .select("*")
    .eq("org_id", orgId)
    .in("status", ["QUEUED", "RUNNING"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as OrgOnboardingScanRunRow | null, error: error as Error | null };
}

export async function updateScanRun(
  supabase: SupabaseClient,
  id: string,
  orgId: string,
  patch: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("org_onboarding_scan_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);
  return { error: error as Error | null };
}
