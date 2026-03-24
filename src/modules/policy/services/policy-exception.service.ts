/**
 * Phase 3 — Policy exception service (§14.4, 18).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PolicyEvaluationContext } from "../domain";
import { listActiveExceptions } from "../repositories/policy-exceptions.repository";

export type ExceptionOverride = {
  exceptionId: string;
  overrideDisposition: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";
  overrideAutonomyMode?: string;
};

export async function getApplicableExceptions(
  supabase: SupabaseClient,
  orgId: string,
  context: PolicyEvaluationContext,
  options?: { blockingPolicyId?: string | null }
): Promise<{ exceptions: ExceptionOverride[]; appliedIds: string[] }> {
  const { data: exceptions } = await listActiveExceptions(supabase, orgId, context as unknown as Record<string, unknown>);
  const applicable: ExceptionOverride[] = [];
  const appliedIds: string[] = [];

  for (const ex of exceptions) {
    if (options?.blockingPolicyId && ex.policy_id !== options.blockingPolicyId) continue;

    if (!exceptionScopeMatches(ex.scope_json, context)) continue;

    const override = ex.override_effect_json as { type?: string; disposition?: string; autonomyMode?: string };
    if (!override?.type) continue;

    applicable.push({
      exceptionId: ex.id,
      overrideDisposition: (override.disposition ?? override.type) as ExceptionOverride["overrideDisposition"],
      overrideAutonomyMode: override.autonomyMode,
    });
    appliedIds.push(ex.id);
  }

  return { exceptions: applicable, appliedIds };
}

function exceptionScopeMatches(scopeJson: Record<string, unknown>, ctx: PolicyEvaluationContext): boolean {
  if (!scopeJson || Object.keys(scopeJson).length === 0) return false;

  if (scopeJson.issueId && ctx.issueId !== scopeJson.issueId) return false;
  if (scopeJson.actionKey && ctx.actionKey !== scopeJson.actionKey) return false;
  if (scopeJson.playbookKey && ctx.playbookKey !== scopeJson.playbookKey) return false;

  return true;
}
