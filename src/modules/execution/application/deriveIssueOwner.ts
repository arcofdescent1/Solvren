/**
 * Phase 0 — Derive issue owner from issues table.
 * Returns owner_user_id and owner_team_key for assignment display and routing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DeriveIssueOwnerResult = {
  userId: string | null;
  teamKey: string | null;
};

export async function deriveIssueOwner(
  supabase: SupabaseClient,
  issueId: string
): Promise<DeriveIssueOwnerResult> {
  const { data, error } = await supabase
    .from("issues")
    .select("owner_user_id, owner_team_key")
    .eq("id", issueId)
    .maybeSingle();

  if (error) {
    return { userId: null, teamKey: null };
  }
  return {
    userId: data?.owner_user_id ?? null,
    teamKey: data?.owner_team_key ?? null,
  };
}
