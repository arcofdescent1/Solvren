/**
 * Phase 6 — Explicit human labels on governance traces (append-only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDecisionLogById } from "@/modules/policy/repositories/policy-decision-logs.repository";
import { insertGovernanceLabel, hasExplicitLabelForTrace } from "../repositories/governance-labels.repository";
import { isExplicitLabelType } from "../types/label-schema";

export type IngestExplicitLabelInput = {
  traceId: string;
  orgId: string;
  labelType: string;
  actorUserId: string;
  rationale?: string | null;
};

export async function ingestExplicitLabel(
  supabase: SupabaseClient,
  input: IngestExplicitLabelInput
): Promise<{ ok: boolean; error?: string }> {
  if (!isExplicitLabelType(input.labelType)) {
    return { ok: false, error: `Invalid explicit label type: ${input.labelType}` };
  }

  const { data: log, error: logErr } = await getDecisionLogById(supabase, input.traceId);
  if (logErr || !log) return { ok: false, error: "Trace not found" };
  if (log.org_id !== input.orgId) return { ok: false, error: "Trace does not belong to org" };

  const { error } = await insertGovernanceLabel(supabase, {
    trace_id: input.traceId,
    org_id: input.orgId,
    label_type: input.labelType,
    label_source: "HUMAN",
    label_actor_id: input.actorUserId,
    confidence: 1,
    rationale: input.rationale ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Implicit labels must not be written when an explicit label already exists (v1 rule). */
export async function canApplyImplicitLabel(supabase: SupabaseClient, traceId: string): Promise<boolean> {
  return !(await hasExplicitLabelForTrace(supabase, traceId));
}
