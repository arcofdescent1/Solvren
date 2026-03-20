/**
 * Phase 2 — Orchestrates simulation creation, execution, and comparison.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SimulationType, SimulationStatus } from "../domain";
import { buildHistoricalWindowSnapshot, buildIssueSetSnapshot, buildDemoSnapshot } from "./simulation-snapshot-builder.service";
import { insertSimulationRun } from "../repositories/simulation-runs.repository";
import { getInputSnapshot } from "../repositories/simulation-input-snapshots.repository";
import { listEntityResults } from "../repositories/simulation-entity-results.repository";
import { updateSimulationRunStatus } from "../repositories/simulation-runs.repository";
import { runSimulation } from "./simulation-replay.service";
import { aggregateEntityResults } from "./simulation-result-aggregator.service";
import { computeConfidence } from "./simulation-confidence.service";
import { compareSimulations } from "./simulation-comparison.service";
import { getPlaybookDefinitionByKey } from "@/modules/autonomy/persistence/playbooks.repository";
import { listActivePolicies } from "@/modules/autonomy/persistence/policies.repository";

export type CreateSimulationRequest = {
  simulationType: SimulationType | string;
  historicalWindowStart: string;
  historicalWindowEnd: string;
  scope?: {
    issueFamily?: string;
    detectorKeys?: string[];
    playbookKey?: string;
    issueIds?: string[];
  };
  config?: {
    playbookKey?: string;
    autonomyMode?: string;
    policyOverrides?: Record<string, unknown>;
  };
};

export type CreateSimulationResult = {
  simulationRunId: string;
  status: SimulationStatus;
};

const MAX_WINDOW_DAYS = 365;
const ENGINE_VERSION = "1.0.0";

export async function createSimulation(
  supabase: SupabaseClient,
  request: CreateSimulationRequest,
  context: { orgId: string; actorUserId?: string | null }
): Promise<{ data: CreateSimulationResult | null; error: Error | null }> {
  const start = new Date(request.historicalWindowStart);
  const end = new Date(request.historicalWindowEnd);
  if (start >= end) return { data: null, error: new Error("Window start must be before end") };

  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (days > MAX_WINDOW_DAYS) return { data: null, error: new Error(`Window exceeds max ${MAX_WINDOW_DAYS} days`) };

  const orgId = context.orgId;
  if (!orgId) return { data: null, error: new Error("Org not found") };

  const scope = request.scope ?? {};
  let snapshotResult: { data: { snapshotId: string; warnings: string[] } | null; error: Error | null };

  if (request.simulationType === SimulationType.DEMO_SCENARIO) {
    snapshotResult = await buildDemoSnapshot(supabase, orgId, (request.config?.playbookKey as string) ?? "failed_payment_recovery");
  } else if (scope.issueIds?.length) {
    snapshotResult = await buildIssueSetSnapshot(supabase, orgId, scope.issueIds);
  } else {
    snapshotResult = await buildHistoricalWindowSnapshot(supabase, orgId, {
      start: request.historicalWindowStart,
      end: request.historicalWindowEnd,
    }, scope);
  }

  if (snapshotResult.error || !snapshotResult.data) {
    return { data: null, error: snapshotResult.error ?? new Error("Snapshot build failed") };
  }

  const playbookKey = request.config?.playbookKey ?? scope.playbookKey ?? "failed_payment_recovery";
  const { data: playbook } = await getPlaybookDefinitionByKey(supabase, playbookKey);
  const { data: policies } = await listActivePolicies(supabase, orgId);

  const policySnapshot = (policies ?? []).reduce((acc, p) => {
    acc[p.policy_key] = { autonomy_mode: p.autonomy_mode, rules: p.policy_rules_json };
    return acc;
  }, {} as Record<string, unknown>);

  const playbookSnapshot = playbook
    ? { playbook_key: playbook.playbook_key, steps: playbook.steps_json, version: playbook.playbook_version }
    : { playbook_key: playbookKey, steps: [], version: "1.0" };

  const config = request.config ?? {};
  const policyOverrides = config.policyOverrides ?? {};
  Object.assign(policySnapshot, policyOverrides);

  const deterministicSeed = `${request.historicalWindowStart}-${request.historicalWindowEnd}-${playbookKey}-${ENGINE_VERSION}`;

  const { data: run, error: runErr } = await insertSimulationRun(supabase, {
    org_id: orgId,
    simulation_type: request.simulationType,
    historical_window_start: request.historicalWindowStart,
    historical_window_end: request.historicalWindowEnd,
    scope_json: scope,
    config_json: config,
    input_snapshot_id: snapshotResult.data.snapshotId,
    policy_snapshot_json: policySnapshot,
    playbook_snapshot_json: playbookSnapshot,
    assumption_snapshot_json: {},
    engine_snapshot_json: { version: ENGINE_VERSION },
    deterministic_seed: deterministicSeed,
    created_by_user_id: context.actorUserId ?? null,
  });

  if (runErr || !run) return { data: null, error: runErr ?? new Error("Failed to create run") };

  return { data: { simulationRunId: run.id, status: SimulationStatus.QUEUED }, error: null };
}

export async function executeSimulation(
  supabase: SupabaseClient,
  runId: string
): Promise<{ error: Error | null }> {
  const { data: run } = await (await import("../repositories/simulation-runs.repository")).getSimulationRun(supabase, runId);
  if (!run) return { error: new Error("Run not found") };
  if (run.status !== SimulationStatus.QUEUED) return { error: new Error("Run not in QUEUED state") };

  await updateSimulationRunStatus(supabase, runId, SimulationStatus.RUNNING, {
    started_at: new Date().toISOString(),
  });

  const { data: snapshot } = await getInputSnapshot(supabase, run.input_snapshot_id!);
  if (!snapshot) {
    await updateSimulationRunStatus(supabase, runId, SimulationStatus.FAILED);
    return { error: new Error("Input snapshot not found") };
  }

  const { warnings } = await runSimulation(supabase, runId, snapshot, {
    runId,
    orgId: run.org_id,
    policySnapshot: run.policy_snapshot_json as Record<string, unknown>,
    playbookSnapshot: run.playbook_snapshot_json as Record<string, unknown>,
    seed: run.deterministic_seed,
  });

  const { data: entities } = await listEntityResults(supabase, runId);
  const summary = aggregateEntityResults(entities ?? []);
  const confidence = computeConfidence({
    snapshotCompleteness: 0.95,
    issueCoverage: entities && entities.length > 0 ? Math.min(1, entities.length / 10) : 0.5,
    policyResolutionCompleteness: 1,
  });

  await updateSimulationRunStatus(supabase, runId, SimulationStatus.COMPLETED, {
    completed_at: new Date().toISOString(),
    result_summary_json: summary,
    confidence_summary_json: { score: confidence.score, band: confidence.band, interval: confidence.interval, reasons: confidence.reasons },
    warning_summary_json: warnings,
  });

  return { error: null };
}

export async function cancelSimulation(
  supabase: SupabaseClient,
  runId: string
): Promise<{ error: Error | null }> {
  const { data: run } = await (await import("../repositories/simulation-runs.repository")).getSimulationRun(supabase, runId);
  if (!run) return { error: new Error("Run not found") };
  if (run.status !== SimulationStatus.QUEUED && run.status !== SimulationStatus.RUNNING) {
    return { error: new Error("Run cannot be canceled") };
  }
  await updateSimulationRunStatus(supabase, runId, SimulationStatus.CANCELED);
  return { error: null };
}

export async function compareSimulationRuns(
  supabase: SupabaseClient,
  orgId: string,
  baselineRunId: string,
  candidateRunId: string
): Promise<{ data: Awaited<ReturnType<typeof compareSimulations>>["data"]; error: Error | null }> {
  return compareSimulations(supabase, orgId, baselineRunId, candidateRunId);
}
