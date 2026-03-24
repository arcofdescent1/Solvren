/**
 * Phase 3 — Checkpoint manager for incremental sync.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCheckpoint(
  supabase: SupabaseClient,
  params: { integrationAccountId: string; sourceObjectType: string }
): Promise<{ checkpoint: Record<string, unknown> | null; error?: string }> {
  const { data, error } = await supabase
    .from("integration_sync_checkpoints")
    .select("checkpoint_json")
    .eq("integration_account_id", params.integrationAccountId)
    .eq("source_object_type", params.sourceObjectType)
    .maybeSingle();

  if (error) return { checkpoint: null, error: error.message };
  const row = data as { checkpoint_json?: Record<string, unknown> } | null;
  return { checkpoint: row?.checkpoint_json ?? null };
}

export async function saveCheckpoint(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    integrationAccountId: string;
    sourceObjectType: string;
    checkpoint: Record<string, unknown>;
  }
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("integration_sync_checkpoints")
    .upsert(
      {
        org_id: params.orgId,
        integration_account_id: params.integrationAccountId,
        source_object_type: params.sourceObjectType,
        checkpoint_json: params.checkpoint,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_account_id,source_object_type" }
    );
  return { error: error?.message };
}
