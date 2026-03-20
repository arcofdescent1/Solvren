/**
 * Phase 8 — Demo org resets repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoOrgReset, DemoResetStatus } from "../domain";

export type DemoOrgResetRow = {
  id: string;
  org_id: string;
  scenario_key: string;
  seed_version: string;
  reset_status: string;
  requested_by_user_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function rowToReset(row: DemoOrgResetRow): DemoOrgReset {
  return {
    id: row.id,
    orgId: row.org_id,
    scenarioKey: row.scenario_key,
    seedVersion: row.seed_version,
    resetStatus: row.reset_status as DemoResetStatus,
    requestedByUserId: row.requested_by_user_id ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function createDemoOrgReset(
  supabase: SupabaseClient,
  input: { orgId: string; scenarioKey: string; seedVersion: string; requestedByUserId?: string }
): Promise<{ data: DemoOrgReset | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("demo_org_resets")
    .insert({
      org_id: input.orgId,
      scenario_key: input.scenarioKey,
      seed_version: input.seedVersion,
      reset_status: "queued",
      requested_by_user_id: input.requestedByUserId ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error as Error };
  return { data: rowToReset(data as DemoOrgResetRow), error: null };
}

export async function getLatestDemoOrgReset(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: DemoOrgReset | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("demo_org_resets")
    .select("id, org_id, scenario_key, seed_version, reset_status, requested_by_user_id, started_at, completed_at, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error as Error };
  return { data: data ? rowToReset(data as DemoOrgResetRow) : null, error: null };
}
