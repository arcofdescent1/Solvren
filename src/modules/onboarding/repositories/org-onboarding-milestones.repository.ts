/**
 * Phase 10 — org_onboarding_milestones repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingMilestone, OnboardingMilestoneKey } from "../domain";
import { ONBOARDING_MILESTONE_KEYS } from "../domain";

export type OrgOnboardingMilestoneRow = {
  id: string;
  org_id: string;
  milestone_key: string;
  reached: boolean;
  reached_at: string | null;
  detail_payload_json: unknown;
  created_at: string;
  updated_at: string;
};

export async function listOrgOnboardingMilestones(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OnboardingMilestone[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_onboarding_milestones")
    .select("*")
    .eq("org_id", orgId)
    .order("milestone_key");
  if (error) return { data: [], error: error as Error };

  const rows = (data ?? []) as OrgOnboardingMilestoneRow[];
  const byKey = new Map(rows.map((r) => [r.milestone_key, r]));

  const result: OnboardingMilestone[] = ONBOARDING_MILESTONE_KEYS.map((key) => {
    const r = byKey.get(key);
    if (r) {
      return {
        id: r.id,
        orgId: r.org_id,
        milestoneKey: key,
        reached: r.reached,
        reachedAt: r.reached_at ?? undefined,
        detailPayloadJson: (r.detail_payload_json ?? {}) as Record<string, unknown>,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }
    return {
      id: "",
      orgId,
      milestoneKey: key,
      reached: false,
      detailPayloadJson: {},
      createdAt: "",
      updatedAt: "",
    };
  });
  return { data: result, error: null };
}

export async function markMilestoneReached(
  supabase: SupabaseClient,
  orgId: string,
  milestoneKey: OnboardingMilestoneKey,
  payload?: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("org_onboarding_milestones").upsert(
    {
      org_id: orgId,
      milestone_key: milestoneKey,
      reached: true,
      reached_at: now,
      detail_payload_json: payload ?? {},
      updated_at: now,
    },
    { onConflict: "org_id,milestone_key" }
  );
  return { error: error as Error | null };
}

export async function getMilestoneReached(
  supabase: SupabaseClient,
  orgId: string,
  milestoneKey: OnboardingMilestoneKey
): Promise<{ reached: boolean; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_onboarding_milestones")
    .select("reached")
    .eq("org_id", orgId)
    .eq("milestone_key", milestoneKey)
    .maybeSingle();
  if (error) return { reached: false, error: error as Error };
  return { reached: (data as { reached?: boolean })?.reached ?? false, error: null };
}
