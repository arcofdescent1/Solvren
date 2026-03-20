/**
 * Phase 4 — Detector engine (§8).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listEnabledDetectorConfigs } from "../persistence/detector-configs.repository";
import { getDetectorDefinitionById } from "../persistence/detector-definitions.repository";
import { listNormalizedSignals } from "@/modules/signals/persistence/normalized-signals.repository";
import { runDetector } from "./detector-runner.service";

export async function runScheduledDetectorsForOrg(
  supabase: SupabaseClient,
  orgId: string,
  windowHours = 168
): Promise<{ runs: number; errors: number }> {
  const { data: configs } = await listEnabledDetectorConfigs(supabase, orgId);
  const windowEnd = new Date();
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  let runs = 0;
  let errors = 0;

  for (const config of configs) {
    const { data: def } = await getDetectorDefinitionById(supabase, config.detector_definition_id);
    if (!def) continue;

    const requiredSignals = (def.required_signal_keys_json ?? []) as string[];
    const { data: signals } = await listNormalizedSignals(supabase, {
      orgId,
      signalKey: requiredSignals[0],
      fromTime: windowStart.toISOString(),
      toTime: windowEnd.toISOString(),
      limit: 100,
    });

    const result = await runDetector(supabase, {
      orgId,
      detectorKey: def.detector_key,
      signals,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });
    runs++;
    if (!result.ok) errors++;
  }
  return { runs, errors };
}
