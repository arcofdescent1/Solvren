/**
 * Phase 2 — Sync cursor management.
 * Store and retrieve cursors per org/provider/object for incremental sync.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSyncCursor(
  supabase: SupabaseClient,
  _params: { orgId: string; provider: string; objectType: string }
): Promise<Record<string, unknown> | null> {
  await supabase
    .from("integration_sync_jobs")
    .select("cursor_json")
    .eq("integration_account_id", "")
    .limit(1);
  // Use metadata or a dedicated cursors table if available.
  // For now, cursors are passed via job cursor_json.
  return null;
}

export async function saveSyncCursor(
  _supabase: SupabaseClient,
  _params: { orgId: string; provider: string; objectType: string; cursor: Record<string, unknown> }
): Promise<void> {
  // Persist cursor - can use integration_supported_objects.metadata_json or a dedicated table.
}
