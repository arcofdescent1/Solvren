/**
 * Phase 2 — Rebuild canonical relationships for an org (§13).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { rebuildRelationshipsForOrg } from "../services/relationshipResolver";

export type RebuildRelationshipsInput = { orgId: string };

export type RebuildRelationshipsResult = { created: number; errors: number };

export async function runRebuildRelationshipsJob(
  supabase: SupabaseClient,
  input: RebuildRelationshipsInput
): Promise<RebuildRelationshipsResult> {
  return rebuildRelationshipsForOrg(supabase, input.orgId);
}
