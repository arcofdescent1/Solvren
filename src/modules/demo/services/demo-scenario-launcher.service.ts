/**
 * Phase 8 — Demo scenario launcher.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDemoOrg } from "./demo-safety.service";
import { resetDemoOrg } from "./demo-reset.service";
import { upsertOrgDemoConfig } from "../repositories/org-demo-config.repository";
import { getDemoScenarioByKey } from "../repositories/demo-scenarios.repository";

export type LaunchScenarioInput = {
  orgId: string;
  scenarioKey: string;
  seedVersion?: string;
  resetBeforeLaunch?: boolean;
};

export async function launchDemoScenario(
  supabase: SupabaseClient,
  input: LaunchScenarioInput
): Promise<{ status: "completed" | "failed" | "queued"; scenarioKey: string; error?: string }> {
  const safe = await assertDemoOrg(supabase, input.orgId);
  if (!safe.ok) return { status: "failed", scenarioKey: input.scenarioKey, error: safe.error };

  const { data: scenario } = await getDemoScenarioByKey(supabase, input.scenarioKey);
  if (!scenario) return { status: "failed", scenarioKey: input.scenarioKey, error: `Scenario not found: ${input.scenarioKey}` };

  if (input.resetBeforeLaunch !== false) {
    const result = await resetDemoOrg(supabase, {
      orgId: input.orgId,
      scenarioKey: input.scenarioKey,
      resetMode: "full",
    });
    if (result.status === "failed") {
      return { status: "failed", scenarioKey: input.scenarioKey, error: result.error };
    }
    return { status: result.status, scenarioKey: input.scenarioKey };
  }

  // Just update org config with scenario
  await upsertOrgDemoConfig(supabase, {
    orgId: input.orgId,
    isDemoOrg: true,
    demoScenarioKey: input.scenarioKey,
    demoResetAllowed: true,
    demoExternalWriteDisabled: true,
  });
  return { status: "completed", scenarioKey: input.scenarioKey };
}
