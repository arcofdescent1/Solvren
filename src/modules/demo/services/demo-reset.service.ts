/**
 * Phase 8 — Demo reset service.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDemoOrg } from "./demo-safety.service";
import { clearDemoData, seedDemoScenario } from "./demo-seed.service";
import { createDemoOrgReset } from "../repositories/demo-org-resets.repository";
import { upsertOrgDemoConfig } from "../repositories/org-demo-config.repository";
import { getDemoScenarioByKey } from "../repositories/demo-scenarios.repository";

export type ResetMode = "full" | "scenario_only" | "data_refresh";

export type ResetDemoOrgInput = {
  orgId: string;
  scenarioKey: string;
  resetMode?: ResetMode;
  requestedByUserId?: string;
};

export async function resetDemoOrg(
  supabase: SupabaseClient,
  input: ResetDemoOrgInput
): Promise<{ status: "queued" | "completed" | "failed"; error?: string }> {
  const safe = await assertDemoOrg(supabase, input.orgId);
  if (!safe.ok) return { status: "failed", error: safe.error };

  const { data: scenario } = await getDemoScenarioByKey(supabase, input.scenarioKey);
  if (!scenario) return { status: "failed", error: `Scenario not found: ${input.scenarioKey}` };
  const seedVersion = scenario.seedVersion;

  const { data: resetRow, error: createErr } = await createDemoOrgReset(supabase, {
    orgId: input.orgId,
    scenarioKey: input.scenarioKey,
    seedVersion,
    requestedByUserId: input.requestedByUserId,
  });
  if (createErr || !resetRow) return { status: "failed", error: createErr?.message ?? "Failed to create reset record" };

  const now = () => new Date().toISOString();
  const updateReset = async (status: "running" | "completed" | "failed") => {
    const payload: Record<string, unknown> = { reset_status: status };
    if (status === "running") payload.started_at = now();
    if (status !== "running") payload.completed_at = now();
    await supabase.from("demo_org_resets").update(payload).eq("id", resetRow.id);
  };

  await updateReset("running");

  const { error: clearErr } = await clearDemoData(supabase, input.orgId);
  if (clearErr) {
    await updateReset("failed");
    return { status: "failed", error: clearErr };
  }

  const { error: seedErr } = await seedDemoScenario(supabase, input.orgId, input.scenarioKey, seedVersion);
  if (seedErr) {
    await updateReset("failed");
    return { status: "failed", error: seedErr };
  }

  await updateReset("completed");

  await upsertOrgDemoConfig(supabase, {
    orgId: input.orgId,
    isDemoOrg: true,
    demoScenarioKey: input.scenarioKey,
    demoResetAllowed: true,
    demoExternalWriteDisabled: true,
    lastResetAt: new Date().toISOString(),
    validationStatus: "healthy",
  });

  return { status: "completed" };
}
