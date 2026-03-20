/**
 * Phase 2 — entity_resolution_rules repository (§8.7).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type EntityResolutionRuleRow = {
  id: string;
  org_id: string;
  entity_type: string;
  rule_key: string;
  enabled: boolean;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function listResolutionRules(
  supabase: SupabaseClient,
  params: { orgId: string; entityType?: string; enabled?: boolean }
): Promise<{ data: EntityResolutionRuleRow[]; error: Error | null }> {
  let q = supabase
    .from("entity_resolution_rules")
    .select("*")
    .eq("org_id", params.orgId);
  if (params.entityType) q = q.eq("entity_type", params.entityType);
  if (params.enabled != null) q = q.eq("enabled", params.enabled);
  q = q.order("entity_type").order("rule_key");
  const { data, error } = await q;
  return { data: (data ?? []) as EntityResolutionRuleRow[], error: error as Error | null };
}

