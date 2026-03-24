/**
 * Phase 6 — Suggestions must never weaken platform non-relaxable policies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPolicyById } from "@/modules/policy/repositories/policies.repository";

export async function assertSuggestionAllowedForPolicy(
  supabase: SupabaseClient,
  policyId: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!policyId) return { ok: true };
  const { data: policy, error } = await getPolicyById(supabase, policyId);
  if (error || !policy) return { ok: false, reason: "Policy not found" };
  const owner = String(policy.policy_owner_type ?? "").toUpperCase();
  const relax = String(policy.relaxation_mode ?? "").toUpperCase();
  if (owner === "PLATFORM" && relax === "NON_RELAXABLE") {
    return {
      ok: false,
      reason: "Cannot generate suggestions that weaken platform non-relaxable policies",
    };
  }
  return { ok: true };
}
