/**
 * Phase 8 — Demo seed service.
 * Clears demo data and reseeds for a scenario.
 *
 * Governance data (`change_events`, approvals, evidence, etc.) is not reset here.
 * Sales demo orgs use `scripts/seed-solara-demo.ts` (operator script); a future
 * extension can call shared builders from `resetDemoOrg` for demo-flag orgs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getScenarioBuilder } from "../seed/scenario-registry";

export async function clearDemoData(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ error: string | null }> {
  // 1. Timeline events: issue_id is SET NULL on issue delete, so we must delete explicitly
  const { error: timelineErr } = await supabase.from("revenue_timeline_events").delete().eq("org_id", orgId);
  if (timelineErr) return { error: `Failed to clear timeline: ${timelineErr.message}` };

  // 2. Outcomes reference issues; deleting issues CASCADE deletes outcomes. But we want to clear
  //    any orphaned outcomes too. Delete by org_id.
  const { error: outcomesErr } = await supabase.from("outcomes").delete().eq("org_id", orgId);
  if (outcomesErr) return { error: `Failed to clear outcomes: ${outcomesErr.message}` };

  // 3. Issues (DEMO-*): CASCADE deletes issue_actions
  const { error: issuesErr } = await supabase.from("issues").delete().eq("org_id", orgId).like("issue_key", "DEMO-%");
  if (issuesErr) return { error: `Failed to clear issues: ${issuesErr.message}` };

  return { error: null };
}

export async function seedDemoScenario(
  supabase: SupabaseClient,
  orgId: string,
  scenarioKey: string,
  _seedVersion: string
): Promise<{ error: string | null }> {
  const builder = getScenarioBuilder(scenarioKey);
  if (!builder) return { error: `Unknown scenario: ${scenarioKey}` };

  const seed = builder(orgId);
  if (seed.scenarioKey !== scenarioKey && scenarioKey !== "executive_hero") {
    // Wrapper scenarios use executive_hero data
  }

  const { issues, actions, outcomes, timeline } = seed;

  const { error: issuesErr } = await supabase.from("issues").insert(issues);
  if (issuesErr) return { error: `Failed to seed issues: ${issuesErr.message}` };

  const { error: actionsErr } = await supabase.from("issue_actions").insert(actions);
  if (actionsErr) return { error: `Failed to seed actions: ${actionsErr.message}` };

  const { error: outcomesErr } = await supabase.from("outcomes").insert(outcomes);
  if (outcomesErr) return { error: `Failed to seed outcomes: ${outcomesErr.message}` };

  const { error: timelineErr } = await supabase.from("revenue_timeline_events").insert(timeline);
  if (timelineErr) return { error: `Failed to seed timeline: ${timelineErr.message}` };

  return { error: null };
}
