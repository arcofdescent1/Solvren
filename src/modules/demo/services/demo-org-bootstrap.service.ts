/**
 * Phase 8 — Demo org bootstrap.
 * Marks an org as demo and optionally launches initial scenario.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertOrgDemoConfig } from "../repositories/org-demo-config.repository";
import { launchDemoScenario } from "./demo-scenario-launcher.service";

export type BootstrapDemoOrgInput = {
  orgId: string;
  scenarioKey?: string;
  launchScenario?: boolean;
};

export async function bootstrapDemoOrg(
  supabase: SupabaseClient,
  input: BootstrapDemoOrgInput
): Promise<{ error: string | null }> {
  await upsertOrgDemoConfig(supabase, {
    orgId: input.orgId,
    isDemoOrg: true,
    demoScenarioKey: input.scenarioKey ?? null,
    demoResetAllowed: true,
    demoAutoRefreshEnabled: false,
    demoExternalWriteDisabled: true,
  });

  if (input.launchScenario && input.scenarioKey) {
    const result = await launchDemoScenario(supabase, {
      orgId: input.orgId,
      scenarioKey: input.scenarioKey,
      resetBeforeLaunch: true,
    });
    if (result.status === "failed") return { error: result.error ?? "Launch failed" };
  }

  return { error: null };
}
