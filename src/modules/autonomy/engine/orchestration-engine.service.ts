/**
 * Phase 8 — Orchestration engine (§11).
 * Runs multi-step playbooks, manages workflow state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlaybookDefinitionByKey } from "../persistence/playbooks.repository";
import {
  insertWorkflowRun,
  updateWorkflowRun,
  getWorkflowRun,
  insertWorkflowStepRun,
  listStepRunsForWorkflow,
} from "../persistence/workflow-runs.repository";
import { evaluatePolicy } from "./policy-engine.service";

export type StartWorkflowInput = {
  orgId: string;
  playbookKey: string;
  issueId: string;
  autonomyMode: string;
  inputSnapshot?: Record<string, unknown>;
};

export type StartWorkflowResult =
  | { ok: true; runId: string }
  | { ok: false; error: string };

export async function startWorkflow(
  supabase: SupabaseClient,
  input: StartWorkflowInput
): Promise<StartWorkflowResult> {
  const { data: playbook } = await getPlaybookDefinitionByKey(supabase, input.playbookKey);
  if (!playbook) return { ok: false, error: "Playbook not found" };

  const policyResult = await evaluatePolicy(supabase, {
    orgId: input.orgId,
    playbookKey: input.playbookKey,
  });

  if (policyResult.blocked || policyResult.automationPaused) {
    return { ok: false, error: policyResult.blockedReason ?? "Policy blocks this playbook" };
  }

  const steps = (playbook.steps_json ?? []) as Array<{ key: string; type: string; order: number; actionKey?: string }>;
  const firstStep = steps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

  const { data: run, error: runErr } = await insertWorkflowRun(supabase, {
    org_id: input.orgId,
    playbook_definition_id: playbook.id,
    issue_id: input.issueId,
    finding_id: null,
    entry_signal_id: null,
    run_status: "running",
    current_step_key: firstStep?.key ?? null,
    autonomy_mode: input.autonomyMode,
    policy_snapshot_json: {},
    input_snapshot_json: input.inputSnapshot ?? {},
    started_at: new Date().toISOString(),
    completed_at: null,
  });

  if (runErr || !run) return { ok: false, error: (runErr as Error)?.message ?? "Failed to create workflow run" };

  for (const step of steps) {
    await insertWorkflowStepRun(supabase, {
      workflow_run_id: run.id,
      step_key: step.key,
      step_type: step.type,
      status: "pending",
      decision_log_id: null,
      action_execution_id: null,
      input_json: {},
      output_json: {},
      started_at: null,
      completed_at: null,
    });
  }

  return { ok: true, runId: run.id };
}

export async function advanceWorkflowStep(
  supabase: SupabaseClient,
  runId: string,
  stepKey: string,
  result: { success: boolean; output?: Record<string, unknown>; actionId?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { data: wr } = await getWorkflowRun(supabase, runId);
  if (!wr) return { ok: false, error: "Workflow run not found" };
  if (wr.run_status !== "running") return { ok: false, error: "Workflow not running" };

  const { data: steps } = await listStepRunsForWorkflow(supabase, runId);
  const stepRuns = steps ?? [];
  const currentIdx = stepRuns.findIndex((s) => s.step_key === stepKey);
  if (currentIdx < 0) return { ok: false, error: "Step not found" };

  await supabase
    .from("workflow_step_runs")
    .update({
      status: result.success ? "completed" : "failed",
      output_json: result.output ?? {},
      completed_at: new Date().toISOString(),
    })
    .eq("workflow_run_id", runId)
    .eq("step_key", stepKey);

  if (!result.success) {
    await updateWorkflowRun(supabase, runId, { run_status: "failed", completed_at: new Date().toISOString() });
    return { ok: true };
  }

  const nextStep = stepRuns[currentIdx + 1];
  if (nextStep) {
    await updateWorkflowRun(supabase, runId, { current_step_key: nextStep.step_key });
  } else {
    await updateWorkflowRun(supabase, runId, {
      run_status: "completed",
      completed_at: new Date().toISOString(),
      current_step_key: null,
    });
  }

  return { ok: true };
}
