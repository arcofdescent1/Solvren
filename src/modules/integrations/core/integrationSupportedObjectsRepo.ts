/**
 * Phase 1 — integration_supported_objects persistence (§8.10).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationSupportedObjectRow = {
  id: string;
  integration_account_id: string;
  object_type: string;
  read_enabled: boolean;
  write_enabled: boolean;
  event_enabled: boolean;
  backfill_complete: boolean;
  last_synced_at: string | null;
  metadata_json: Record<string, unknown>;
};

export async function getSupportedObjectsByAccountId(
  supabase: SupabaseClient,
  integrationAccountId: string
): Promise<{ data: IntegrationSupportedObjectRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_supported_objects")
    .select("*")
    .eq("integration_account_id", integrationAccountId);
  return { data: (data ?? []) as IntegrationSupportedObjectRow[], error: error as Error | null };
}

export async function upsertSupportedObject(
  supabase: SupabaseClient,
  integrationAccountId: string,
  objectType: string,
  updates: Partial<Pick<IntegrationSupportedObjectRow, "read_enabled" | "write_enabled" | "event_enabled" | "backfill_complete" | "last_synced_at" | "metadata_json">>
): Promise<{ error: Error | null }> {
  const { data: existing } = await supabase
    .from("integration_supported_objects")
    .select("id")
    .eq("integration_account_id", integrationAccountId)
    .eq("object_type", objectType)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("integration_supported_objects")
      .update(updates)
      .eq("id", (existing as { id: string }).id);
    return { error: error as Error | null };
  }
  const { error } = await supabase.from("integration_supported_objects").insert({
    integration_account_id: integrationAccountId,
    object_type: objectType,
    read_enabled: updates.read_enabled ?? false,
    write_enabled: updates.write_enabled ?? false,
    event_enabled: updates.event_enabled ?? false,
    backfill_complete: updates.backfill_complete ?? false,
    last_synced_at: updates.last_synced_at ?? null,
    metadata_json: updates.metadata_json ?? {},
  });
  return { error: error as Error | null };
}
