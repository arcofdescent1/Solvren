/**
 * Phase 4 — Event-driven detector trigger (§8).
 * Invoke detectors when a new normalized signal is created.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNormalizedSignalById } from "@/modules/signals/persistence/normalized-signals.repository";
import { listNormalizedSignals } from "@/modules/signals/persistence/normalized-signals.repository";
import { getDetectorKeysForSignal } from "./detector-subscription.service";
import { getDetectorDefinitionByKey } from "../persistence/detector-definitions.repository";
import { runDetector } from "./detector-runner.service";

/**
 * Trigger event-driven detectors for a newly created signal.
 * Fire-and-forget: does not block signal processing.
 */
export function triggerDetectorsForNewSignal(
  supabase: SupabaseClient,
  orgId: string,
  signalId: string
): void {
  triggerDetectorsForNewSignalAsync(supabase, orgId, signalId).catch((err) => {
    console.error("[detection] Event-driven trigger failed:", err);
  });
}

async function triggerDetectorsForNewSignalAsync(
  supabase: SupabaseClient,
  orgId: string,
  signalId: string
): Promise<void> {
  const { data: signal } = await getNormalizedSignalById(supabase, signalId);
  if (!signal) return;

  const detectorKeys = await getDetectorKeysForSignal(supabase, signal.signal_key);
  if (detectorKeys.length === 0) return;

  const signalTime = new Date(signal.signal_time);
  const windowHours = 168;
  const windowStart = new Date(signalTime.getTime() - windowHours * 60 * 60 * 1000);
  const windowEnd = new Date(signalTime.getTime() + 60 * 60 * 1000);

  for (const detectorKey of detectorKeys) {
    const { data: def } = await getDetectorDefinitionByKey(supabase, detectorKey);
    if (!def) continue;

    const requiredKeys = (def.required_signal_keys_json ?? []) as string[];
    const signalKeys = [...new Set([signal.signal_key, ...requiredKeys])];
    const seen = new Set<string>();
    const allSignals: typeof signal[] = [];
    for (const sk of signalKeys) {
      const { data: sigs } = await listNormalizedSignals(supabase, {
        orgId,
        signalKey: sk,
        fromTime: windowStart.toISOString(),
        toTime: windowEnd.toISOString(),
        limit: 50,
      });
      for (const s of sigs) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          allSignals.push(s);
        }
      }
    }

    await runDetector(supabase, {
      orgId,
      detectorKey,
      signals: allSignals,
      triggerSignalId: signalId,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });
  }
}
