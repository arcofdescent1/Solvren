/**
 * Phase 8 — Orchestration engine (§11).
 * Runs multi-step playbooks, manages workflow state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlaybookDefinitionByKey, getPlaybookDefinitionById } from "../persistence/playbooks.repository";
import {
  insertWorkflowRun,
  updateWorkflowRun,
  getWorkflowRun,
  insertWorkflowStepRun,
  listStepRunsForWorkflow,
} from "../persistence/workflow-runs.repository";
import { getOrgAutonomySettings } from "../persistence/policies.repository";
import { evaluateGovernance, deploymentGovernanceEnvironment } from "@/modules/governance";
import type { GovernanceAutonomyMode } from "@/modules/governance/types/governance-context";

function mapWorkflowAutonomyToGovernance(mode: string): GovernanceAutonomyMode {
  if (mode === "manual_only") return "MANUAL";
  if (mode === "suggest_only") return "SUGGESTED";
  if (mode === "approve_then_execute") return "ASSISTED";
  if (mode === "auto_execute_low_risk" || mode === "auto_execute_policy_bounded") return "AUTO";
  return "ASSISTED";
}

type PlaybookStepJson = { key: string; type: string; order?: number; actionKey?: string };

function playbookStepDefinitionNeedsGovernance(step: PlaybookStepJson | undefined): boolean {
  if (!step) return false;
  if (step.type === "action" && step.actionKey) return true;
  if (step.type === "notification") return true;
  if (step.type === "approval") return true;
  return false;
}

export type StartWorkflowInput = {
  orgId: string;
  playbookKey: string;
  issueId: string;
  autonomyMode: string;
  inputSnapshot?: Record<string, unknown>;
  /** Phase 5 — governance actor (admin playbook run). */
  actorUserId?: string;
  actorRoleKeys?: string[];
  governanceIssue?: {
    issueId: string;
    severity?: string;
    impactAmount?: number;
    confidence?: number;
  };
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

  const { data: autonomySettings } = await getOrgAutonomySettings(supabase, input.orgId);
  if (autonomySettings?.automation_paused) {
    return { ok: false, error: "Automation paused for org" };
  }

  const gi = input.governanceIssue;
  const { data: gov, error: govErr } = await evaluateGovernance(supabase, {
    orgId: input.orgId,
    environment: deploymentGovernanceEnvironment(),
    actor: {
      userId: input.actorUserId,
      actorType: input.actorUserId ? "user" : "system",
      roleKeys: input.actorRoleKeys,
    },
    target: {
      resourceType: "playbook_step",
      transitionKey: "start",
    },
    issue: gi
      ? {
          issueId: gi.issueId,
          severity: gi.severity,
          impactAmount: gi.impactAmount,
          confidence: gi.confidence,
        }
      : { issueId: input.issueId },
    autonomy: { requestedMode: mapWorkflowAutonomyToGovernance(input.autonomyMode) },
    extensions: { playbookKey: input.playbookKey },
  });

  if (govErr) {
    return { ok: false, error: govErr.message };
  }
  if (gov?.disposition === "BLOCK") {
    return { ok: false, error: gov.explainability.headline };
  }
  if (gov?.disposition === "REQUIRE_APPROVAL") {
    return { ok: false, error: "Approval required before this playbook can run" };
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
  result: { success: boolean; output?: Record<string, unknown>; actionId?: string },
  options?: {
    /** When the next step triggers external effects, governance runs before advancing `current_step_key`. */
    governanceActor?: { userId?: string; roleKeys?: string[] };
  }
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
    const { data: playbook } = await getPlaybookDefinitionById(supabase, wr.playbook_definition_id);
    const stepsJson = (playbook?.steps_json ?? []) as PlaybookStepJson[];
    const nextDef = stepsJson.find((s) => s.key === nextStep.step_key);

    if (playbook && playbookStepDefinitionNeedsGovernance(nextDef)) {
      type IssueSnippet = {
        id: string;
        severity?: string;
        impact_score?: number | null;
        confidence_score?: number | null;
      };
      let issueSnippet: IssueSnippet | null = null;
      if (wr.issue_id) {
        const { data: iss } = await supabase
          .from("issues")
          .select("id, severity, impact_score, confidence_score")
          .eq("id", wr.issue_id)
          .maybeSingle();
        issueSnippet = (iss as IssueSnippet | null) ?? null;
      }

      const { data: gov, error: govErr } = await evaluateGovernance(
        supabase,
        {
          orgId: wr.org_id,
          environment: deploymentGovernanceEnvironment(),
          actor: {
            userId: options?.governanceActor?.userId,
            actorType: options?.governanceActor?.userId ? "user" : "system",
            roleKeys: options?.governanceActor?.roleKeys,
          },
          target: {
            resourceType: "playbook_step",
            resourceId: runId,
            transitionKey: "execute_step",
            actionKey: nextDef?.actionKey,
          },
          issue: issueSnippet
            ? {
                issueId: issueSnippet.id,
                severity: issueSnippet.severity,
                impactAmount: issueSnippet.impact_score ?? undefined,
                confidence: issueSnippet.confidence_score ?? undefined,
              }
            : wr.issue_id
              ? { issueId: wr.issue_id }
              : undefined,
          autonomy: { requestedMode: mapWorkflowAutonomyToGovernance(wr.autonomy_mode) },
          extensions: {
            playbookKey: playbook.playbook_key,
            workflowStepKey: nextStep.step_key,
          },
        },
        { persistDecisionLog: true }
      );

      if (govErr) {
        await updateWorkflowRun(supabase, runId, { run_status: "failed", completed_at: new Date().toISOString() });
        return { ok: false, error: govErr.message };
      }
      if (gov?.disposition === "BLOCK") {
        await updateWorkflowRun(supabase, runId, { run_status: "failed", completed_at: new Date().toISOString() });
        return { ok: false, error: gov.explainability.headline };
      }
      if (gov?.disposition === "REQUIRE_APPROVAL") {
        await updateWorkflowRun(supabase, runId, { run_status: "failed", completed_at: new Date().toISOString() });
        return { ok: false, error: "Approval required before the next playbook step can run" };
      }
    }

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
