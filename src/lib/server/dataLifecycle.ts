/**
 * Phase 1 — soft/hard delete and purge helpers (server-only).
 * Call only after authz + audit. RLS must allow the mutation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function softDeleteChangeEvent(
  supabase: SupabaseClient,
  args: { orgId: string; changeId: string }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("change_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", args.changeId)
    .eq("org_id", args.orgId);
  return { error: error ? new Error(error.message) : null };
}

/**
 * Org purge placeholder — implement with explicit table list + service role in a controlled job only.
 * Phase 1: Intentionally unimplemented. Future org deletion / GDPR purge must:
 * - Use createPrivilegedClient with explicit reason
 * - Operate on explicit table list (change_events, issues, integration_connections, etc.)
 * - Require backup + audit log entry before any destructive work
 * - Gate behind a dedicated admin-only cron or manual trigger with confirmation
 * See docs/security-phase0.md Phase 1 pointers.
 */
export async function hardDeleteOrgData(_supabase: SupabaseClient, _orgId: string): Promise<never> {
  throw new Error("hardDeleteOrgData must be implemented as a reviewed admin job with audit + backups");
}

/** Redact user references in metadata columns (best effort). */
export function anonymizeUserReferences(meta: Record<string, unknown>, userId: string): Record<string, unknown> {
  const out = { ...meta };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "string" && out[k] === userId) {
      out[k] = "[redacted-user]";
    }
  }
  return out;
}
