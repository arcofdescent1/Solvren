/**
 * Phase 6 — Accept suggestion → org-owned draft policy (no auto-activation).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { duplicatePolicy, getPolicyById, getPolicyByKey, updatePolicy } from "@/modules/policy/repositories/policies.repository";
import { assertSuggestionAllowedForPolicy } from "./guardrails";
import type { GovernanceRuleSuggestionRow } from "../repositories/governance-suggestions.repository";

export type CreateDraftFromSuggestionResult = {
  draftPolicyId?: string | null;
  skippedReason?: string;
  error?: string;
};

export async function createDraftPolicyFromSuggestion(
  supabase: SupabaseClient,
  orgId: string,
  suggestion: GovernanceRuleSuggestionRow,
  userId: string
): Promise<CreateDraftFromSuggestionResult> {
  if (!suggestion.target_policy_id) {
    return { draftPolicyId: null, skippedReason: "no_target_policy" };
  }

  const guard = await assertSuggestionAllowedForPolicy(supabase, suggestion.target_policy_id);
  if (!guard.ok) {
    return { error: guard.reason };
  }

  const { data: base, error: gErr } = await getPolicyById(supabase, suggestion.target_policy_id);
  if (gErr || !base) {
    return { error: "Target policy not found" };
  }
  if (base.org_id != null && base.org_id !== orgId) {
    return { error: "Target policy is not in this organization" };
  }

  const draftOrgId = base.org_id ?? orgId;
  const short = suggestion.id.replace(/-/g, "").slice(0, 10);
  let policyKey = `${base.policy_key}_learn_${short}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await getPolicyByKey(supabase, draftOrgId, policyKey);
    if (!clash) break;
    policyKey = `${base.policy_key}_learn_${short}_${attempt}`;
  }

  const displayName = `${base.display_name} (learning draft)`;
  const { data: draft, error: dErr } = await duplicatePolicy(supabase, suggestion.target_policy_id, {
    org_id: draftOrgId,
    policy_key: policyKey,
    display_name: displayName,
    created_by_user_id: userId,
  });
  if (dErr || !draft) {
    return { error: dErr?.message ?? "Could not create draft policy" };
  }

  const note = `[Learning suggestion ${suggestion.id}]\nSuggested payload: ${JSON.stringify(suggestion.suggested_rule_json).slice(0, 2000)}`;
  const nextDesc = `${draft.description ?? ""}\n\n${note}`.slice(0, 8000);
  const { error: uErr } = await updatePolicy(supabase, draft.id, {
    description: nextDesc,
    updated_by_user_id: userId,
  });
  if (uErr) {
    return { draftPolicyId: draft.id, skippedReason: "description_update_failed" };
  }

  return { draftPolicyId: draft.id };
}
