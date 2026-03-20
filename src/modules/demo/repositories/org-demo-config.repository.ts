/**
 * Phase 8 — Org demo config repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoOrgConfig } from "../domain";

export type OrgDemoConfigRow = {
  org_id: string;
  is_demo_org: boolean;
  demo_scenario_key: string | null;
  demo_reset_allowed: boolean;
  demo_auto_refresh_enabled: boolean;
  demo_external_write_disabled: boolean;
  last_reset_at: string | null;
  validation_status: string | null;
  created_at: string;
  updated_at: string;
};

function rowToConfig(row: OrgDemoConfigRow): DemoOrgConfig {
  return {
    orgId: row.org_id,
    isDemoOrg: row.is_demo_org,
    demoScenarioKey: row.demo_scenario_key ?? undefined,
    demoResetAllowed: row.demo_reset_allowed,
    demoAutoRefreshEnabled: row.demo_auto_refresh_enabled,
    demoExternalWriteDisabled: row.demo_external_write_disabled,
    lastResetAt: row.last_reset_at ?? undefined,
    validationStatus: row.validation_status ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOrgDemoConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: DemoOrgConfig | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_demo_config")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return { data: null, error: error as Error };
  return { data: data ? rowToConfig(data as OrgDemoConfigRow) : null, error: null };
}

export async function upsertOrgDemoConfig(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    isDemoOrg: boolean;
    demoScenarioKey?: string | null;
    demoResetAllowed?: boolean;
    demoAutoRefreshEnabled?: boolean;
    demoExternalWriteDisabled?: boolean;
    lastResetAt?: string | null;
    validationStatus?: string | null;
  }
): Promise<{ data: DemoOrgConfig | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_demo_config")
    .upsert(
      {
        org_id: input.orgId,
        is_demo_org: input.isDemoOrg,
        demo_scenario_key: input.demoScenarioKey ?? null,
        demo_reset_allowed: input.demoResetAllowed ?? true,
        demo_auto_refresh_enabled: input.demoAutoRefreshEnabled ?? false,
        demo_external_write_disabled: input.demoExternalWriteDisabled ?? true,
        last_reset_at: input.lastResetAt ?? null,
        validation_status: input.validationStatus ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    )
    .select()
    .single();

  if (error) return { data: null, error: error as Error };
  return { data: rowToConfig(data as OrgDemoConfigRow), error: null };
}
