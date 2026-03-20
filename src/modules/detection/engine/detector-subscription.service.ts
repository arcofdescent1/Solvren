/**
 * Phase 4 — Detector subscription service (§8).
 * Determines which detectors subscribe to a signal key.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDetectorDefinitions } from "../persistence/detector-definitions.repository";

export async function getDetectorKeysForSignal(
  supabase: SupabaseClient,
  signalKey: string
): Promise<string[]> {
  const { data: defs } = await listDetectorDefinitions(supabase, { status: "active" });
  const keys: string[] = [];
  for (const d of defs) {
    const required = (d.required_signal_keys_json ?? []) as string[];
    const optional = (d.optional_signal_keys_json ?? []) as string[];
    if (required.includes(signalKey) || optional.includes(signalKey)) {
      keys.push(d.detector_key);
    }
  }
  return keys;
}
