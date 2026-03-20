/**
 * Phase 9 — Automation pause service (§10).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExecutionMode } from "../domain";
import { AutomationPauseType } from "../domain";
import { findMatchingPauses } from "../repositories/autonomy-pause-controls.repository";

export type PauseEffect = {
  effectiveMode: ExecutionMode;
  reasonCodes: string[];
  pauseIds: string[];
};

const PAUSE_TYPE_TO_MODE: Record<AutomationPauseType, ExecutionMode> = {
  [AutomationPauseType.HARD_STOP]: ExecutionMode.SUGGEST_ONLY,
  [AutomationPauseType.DOWNGRADE_TO_APPROVAL]: ExecutionMode.APPROVAL_REQUIRED,
  [AutomationPauseType.DOWNGRADE_TO_SUGGEST]: ExecutionMode.SUGGEST_ONLY,
  [AutomationPauseType.DOWNGRADE_TO_DRY_RUN]: ExecutionMode.DRY_RUN,
};

export async function resolvePauseEffect(
  supabase: SupabaseClient,
  orgId: string,
  context: {
    scopeType?: string;
    scopeRef?: string | null;
    actionKey?: string | null;
    playbookKey?: string | null;
    provider?: string | null;
  }
): Promise<{ applied: boolean; effect: PauseEffect | null; error: Error | null }> {
  const { data: matches, error } = await findMatchingPauses(supabase, orgId, context);
  if (error) return { applied: false, effect: null, error };

  if (matches.length === 0) {
    return { applied: false, effect: null, error: null };
  }

  const hardStop = matches.find((m) => m.pauseType === AutomationPauseType.HARD_STOP);
  const mostRestrictive = hardStop ?? matches[0];
  const effectiveMode = PAUSE_TYPE_TO_MODE[mostRestrictive.pauseType];

  return {
    applied: true,
    effect: {
      effectiveMode,
      reasonCodes: hardStop ? ["hard_stop_pause"] : ["scoped_pause"],
      pauseIds: matches.map((m) => m.id),
    },
    error: null,
  };
}
