/**
 * Phase 8 — playbook_definitions, org_playbook_configs persistence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlaybookDefinitionRow = {
  id: string;
  playbook_key: string;
  display_name: string;
  description: string;
  issue_family: string;
  steps_json: unknown[];
  branching_rules_json: Record<string, unknown>;
  required_actions_json: string[];
  required_integrations_json: string[];
  default_autonomy_mode: string;
  playbook_version: string;
  status: string;
};

export type OrgPlaybookConfigRow = {
  id: string;
  org_id: string;
  playbook_definition_id: string;
  enabled: boolean;
  autonomy_mode_override: string | null;
  rollout_state: string;
};

export async function listPlaybookDefinitions(
  supabase: SupabaseClient,
  statusFilter = "active"
): Promise<{ data: PlaybookDefinitionRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("playbook_definitions")
    .select("*")
    .eq("status", statusFilter)
    .order("playbook_key");
  return { data: (data ?? []) as PlaybookDefinitionRow[], error: error as Error | null };
}

export async function getPlaybookDefinitionByKey(
  supabase: SupabaseClient,
  playbookKey: string,
  version = "1.0"
): Promise<{ data: PlaybookDefinitionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("playbook_definitions")
    .select("*")
    .eq("playbook_key", playbookKey)
    .eq("playbook_version", version)
    .maybeSingle();
  return { data: data as PlaybookDefinitionRow | null, error: error as Error | null };
}

export async function getOrgPlaybookConfigs(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrgPlaybookConfigRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_playbook_configs")
    .select("*")
    .eq("org_id", orgId);
  return { data: (data ?? []) as OrgPlaybookConfigRow[], error: error as Error | null };
}

export async function upsertOrgPlaybookConfig(
  supabase: SupabaseClient,
  orgId: string,
  playbookDefinitionId: string,
  updates: Partial<{ enabled: boolean; autonomy_mode_override: string | null; rollout_state: string }>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("org_playbook_configs")
    .upsert(
      {
        org_id: orgId,
        playbook_definition_id: playbookDefinitionId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,playbook_definition_id" }
    );
  return { error: error as Error | null };
}
