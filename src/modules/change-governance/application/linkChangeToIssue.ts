/**
 * Phase 0 — Link a change to an issue (change_issue_links).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ChangeIssueLinkType = "origin" | "related" | "caused" | "mitigates" | "blocked_by";

export async function linkChangeToIssue(
  supabase: SupabaseClient,
  changeId: string,
  issueId: string,
  linkType: ChangeIssueLinkType
): Promise<{ ok: boolean; error?: string }> {
  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("id, org_id")
    .eq("id", changeId)
    .single();
  if (ceErr || !change) return { ok: false, error: "Change not found" };

  const { data: issue, error: ieErr } = await supabase
    .from("issues")
    .select("id, org_id")
    .eq("id", issueId)
    .single();
  if (ieErr || !issue) return { ok: false, error: "Issue not found" };
  if (issue.org_id !== change.org_id) return { ok: false, error: "Issue and change must belong to the same org" };

  const { error: insertErr } = await supabase.from("change_issue_links").insert({
    change_id: changeId,
    issue_id: issueId,
    link_type: linkType,
  });
  if (insertErr) {
    if (insertErr.code === "23505") return { ok: false, error: "Link already exists" };
    return { ok: false, error: insertErr.message };
  }
  return { ok: true };
}
