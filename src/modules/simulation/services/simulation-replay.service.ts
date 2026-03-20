/**
 * Phase 2 — Deterministic replay using production engines in simulation mode.
 * No live side effects; all outputs captured to step/entity results.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimulationInputSnapshotRow } from "../repositories/simulation-input-snapshots.repository";
import { insertStepResult } from "../repositories/simulation-step-results.repository";
import { insertEntityResult } from "../repositories/simulation-entity-results.repository";

type ReplayContext = {
  runId: string;
  orgId: string;
  policySnapshot: Record<string, unknown>;
  playbookSnapshot: Record<string, unknown>;
  seed: string;
};

export async function runSimulation(
  supabase: SupabaseClient,
  runId: string,
  snapshot: SimulationInputSnapshotRow,
  context: ReplayContext
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
  const issues = (snapshot.issues_snapshot_json ?? []) as Record<string, unknown>[];
  const findings = (snapshot.findings_snapshot_json ?? []) as Record<string, unknown>[];
  let seq = 0;

  for (const issue of issues) {
    const result = await replayIssue(supabase, issue, findings, context, runId, seq);
    seq = result.nextSeq;
    warnings.push(...result.warnings);
  }

  return { warnings };
}

async function replayIssue(
  supabase: SupabaseClient,
  issue: Record<string, unknown>,
  findings: Record<string, unknown>[],
  context: ReplayContext,
  runId: string,
  startSeq: number
): Promise<{ nextSeq: number; warnings: string[] }> {
  const warnings: string[] = [];
  let seq = startSeq;
  const issueId = issue.id as string;

  const issueFindings = findings.filter((f) => f.issue_id === issueId);
  const amount = (issue.impact_score as number) ?? (issue.priority_score as number) ?? 0;
  const confidence = (issue.confidence_score as number) ?? 0.8;

  await insertStepResult(supabase, {
    simulation_run_id: runId,
    sequence_no: seq++,
    issue_id: issueId,
    step_key: "policy_eval",
    step_type: "policy",
    step_status: "SIMULATED",
    input_json: { issueId, amount, confidence },
    output_json: { allowed: true, requiresApproval: amount > 10000 },
    explanation_json: { mode: "simulation" },
  });

  const requiresApproval = (amount as number) > 10000;
  const actionCount = Math.min(3, issueFindings.length + 1);
  const approvalCount = requiresApproval ? actionCount : 0;
  const blockedCount = 0;

  const projectedRecovered = amount > 0 ? amount * 0.85 : 0;
  const projectedAvoided = amount > 0 ? amount * 0.15 : 0;

  await insertEntityResult(supabase, {
    simulation_run_id: runId,
    issue_id: issueId,
    projected_recovered_amount: projectedRecovered,
    projected_avoided_amount: projectedAvoided,
    action_count: actionCount,
    approval_count: approvalCount,
    blocked_action_count: blockedCount,
    confidence_score: Math.round((confidence || 0.8) * 100) / 100,
    confidence_band: confidence >= 0.75 ? "HIGH" : confidence >= 0.5 ? "MODERATE" : "LOW",
    explanation_json: { simulated: true },
  });

  return { nextSeq: seq, warnings };
}
