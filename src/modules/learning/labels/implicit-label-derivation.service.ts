/**
 * Phase 6 — Deterministic implicit labels (inferred, label_source IMPLICIT).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveLabelOfType, insertGovernanceLabel } from "../repositories/governance-labels.repository";
import { canApplyImplicitLabel } from "./label-ingest.service";

const EXCESSIVE_APPROVAL_LATENCY_MS = 48 * 60 * 60 * 1000;

export type ImplicitDerivationResult = {
  inserted: number;
  skipped: number;
  errors: string[];
};

/**
 * Scan recent approval outcome facts and emit IMPLICIT_EXCESSIVE_APPROVAL_LATENCY where applicable.
 */
export async function deriveImplicitLabelsFromApprovalLatency(
  supabase: SupabaseClient,
  orgId: string,
  options?: { sinceHours?: number }
): Promise<ImplicitDerivationResult> {
  const since = new Date(
    Date.now() - (options?.sinceHours ?? 168) * 60 * 60 * 1000
  ).toISOString();

  const { data: rows, error } = await supabase
    .from("governance_approval_outcome_facts")
    .select("trace_id, org_id, approval_latency_ms, approval_status")
    .eq("org_id", orgId)
    .gte("approval_requested_at", since)
    .not("approval_latency_ms", "is", null);

  if (error) {
    return { inserted: 0, skipped: 0, errors: [error.message] };
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows ?? []) {
    const traceId = row.trace_id as string;
    const lat = Number(row.approval_latency_ms ?? 0);
    if (lat < EXCESSIVE_APPROVAL_LATENCY_MS) {
      skipped++;
      continue;
    }
    if (!(await canApplyImplicitLabel(supabase, traceId))) {
      skipped++;
      continue;
    }
    if (await hasActiveLabelOfType(supabase, traceId, "IMPLICIT_EXCESSIVE_APPROVAL_LATENCY")) {
      skipped++;
      continue;
    }

    const { error: insErr } = await insertGovernanceLabel(supabase, {
      trace_id: traceId,
      org_id: orgId,
      label_type: "IMPLICIT_EXCESSIVE_APPROVAL_LATENCY",
      label_source: "IMPLICIT",
      confidence: 0.7,
      rationale: `approval_latency_ms=${Math.round(lat)} (threshold ${EXCESSIVE_APPROVAL_LATENCY_MS})`,
    });
    if (insErr) errors.push(insErr.message);
    else inserted++;
  }

  return { inserted, skipped, errors };
}

type ExecRow = {
  id: string;
  org_id: string;
  issue_id: string | null;
  action_key: string;
  governance_trace_id: string | null;
  execution_status: string;
  created_at: string;
  attempt_count: number | null;
};

function actionKeysLooselyMatch(logKey: string | null, execKey: string): boolean {
  if (!logKey || !execKey) return false;
  if (logKey === execKey) return true;
  if (logKey.endsWith(`.${execKey}`)) return true;
  return false;
}

async function resolveTraceIdForExecution(
  supabase: SupabaseClient,
  exec: ExecRow
): Promise<string | null> {
  if (exec.governance_trace_id) return exec.governance_trace_id;
  if (!exec.issue_id) return null;
  const { data: rows } = await supabase
    .from("policy_decision_logs")
    .select("id, action_key, created_at")
    .eq("org_id", exec.org_id)
    .eq("issue_id", exec.issue_id)
    .lte("created_at", exec.created_at)
    .order("created_at", { ascending: false })
    .limit(8);
  for (const row of rows ?? []) {
    if (actionKeysLooselyMatch((row as { action_key?: string | null }).action_key ?? null, exec.action_key)) {
      return (row as { id: string }).id;
    }
  }
  return null;
}

async function dispositionForTrace(
  supabase: SupabaseClient,
  traceId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("policy_decision_logs")
    .select("final_disposition")
    .eq("id", traceId)
    .maybeSingle();
  return ((data as { final_disposition?: string } | null)?.final_disposition ?? null) as string | null;
}

const MIN_ATTEMPTS_FOR_RETRY_LABEL = 3;

/**
 * FAILED / DEAD_LETTERED executions where the linked governance decision was ALLOW (direct trace or issue+action match).
 */
export async function deriveImplicitExecutionFailedAfterAllow(
  supabase: SupabaseClient,
  orgId: string,
  options?: { sinceHours?: number }
): Promise<ImplicitDerivationResult> {
  const since = new Date(Date.now() - (options?.sinceHours ?? 168) * 60 * 60 * 1000).toISOString();
  const { data: execs, error } = await supabase
    .from("integration_action_executions")
    .select("id, org_id, issue_id, action_key, governance_trace_id, execution_status, created_at, attempt_count")
    .eq("org_id", orgId)
    .gte("created_at", since)
    .in("execution_status", ["FAILED", "DEAD_LETTERED"]);

  if (error) return { inserted: 0, skipped: 0, errors: [error.message] };

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of execs ?? []) {
    const ex = raw as ExecRow;
    const traceId = await resolveTraceIdForExecution(supabase, ex);
    if (!traceId) {
      skipped++;
      continue;
    }
    const disp = await dispositionForTrace(supabase, traceId);
    if (disp !== "ALLOW") {
      skipped++;
      continue;
    }
    if (!(await canApplyImplicitLabel(supabase, traceId))) {
      skipped++;
      continue;
    }
    if (await hasActiveLabelOfType(supabase, traceId, "IMPLICIT_EXECUTION_FAILED_AFTER_ALLOW")) {
      skipped++;
      continue;
    }

    const conf = ex.governance_trace_id ? 0.88 : 0.62;
    const { error: insErr } = await insertGovernanceLabel(supabase, {
      trace_id: traceId,
      org_id: orgId,
      label_type: "IMPLICIT_EXECUTION_FAILED_AFTER_ALLOW",
      label_source: "IMPLICIT",
      confidence: conf,
      rationale: `execution ${ex.id} status=${ex.execution_status} attempts=${ex.attempt_count ?? 0} (inferred)`,
    });
    if (insErr) errors.push(insErr.message);
    else inserted++;
  }

  return { inserted, skipped, errors };
}

/**
 * Open OUTBOUND dead letters: link execution → governance trace → ALLOW implies integration burden after allow.
 */
export async function deriveImplicitDeadLetterBurden(
  supabase: SupabaseClient,
  orgId: string,
  options?: { sinceHours?: number }
): Promise<ImplicitDerivationResult> {
  const since = new Date(Date.now() - (options?.sinceHours ?? 168) * 60 * 60 * 1000).toISOString();
  const { data: dls, error } = await supabase
    .from("integration_dead_letters")
    .select("id, source_record_id, created_at, status")
    .eq("org_id", orgId)
    .eq("dead_letter_type", "OUTBOUND_ACTION")
    .in("status", ["OPEN", "RETRIED"])
    .gte("created_at", since);

  if (error) return { inserted: 0, skipped: 0, errors: [error.message] };

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const dl of dls ?? []) {
    const execId = (dl as { source_record_id: string }).source_record_id;
    const { data: exRaw } = await supabase
      .from("integration_action_executions")
      .select("id, org_id, issue_id, action_key, governance_trace_id, execution_status, created_at, attempt_count")
      .eq("id", execId)
      .maybeSingle();
    if (!exRaw) {
      skipped++;
      continue;
    }
    const ex = exRaw as ExecRow;
    const traceId = await resolveTraceIdForExecution(supabase, ex);
    if (!traceId) {
      skipped++;
      continue;
    }
    const disp = await dispositionForTrace(supabase, traceId);
    if (disp !== "ALLOW") {
      skipped++;
      continue;
    }
    if (!(await canApplyImplicitLabel(supabase, traceId))) {
      skipped++;
      continue;
    }
    if (await hasActiveLabelOfType(supabase, traceId, "IMPLICIT_DEAD_LETTER_BURDEN")) {
      skipped++;
      continue;
    }

    const { error: insErr } = await insertGovernanceLabel(supabase, {
      trace_id: traceId,
      org_id: orgId,
      label_type: "IMPLICIT_DEAD_LETTER_BURDEN",
      label_source: "IMPLICIT",
      confidence: ex.governance_trace_id ? 0.85 : 0.6,
      rationale: `dead_letter ${(dl as { id: string }).id} for execution ${ex.id} (inferred)`,
    });
    if (insErr) errors.push(insErr.message);
    else inserted++;
  }

  return { inserted, skipped, errors };
}

/**
 * High attempt counts after ALLOW — proxy for retry / reliability friction (inferred).
 */
export async function deriveImplicitRepeatedRetryAfterAllow(
  supabase: SupabaseClient,
  orgId: string,
  options?: { sinceHours?: number }
): Promise<ImplicitDerivationResult> {
  const since = new Date(Date.now() - (options?.sinceHours ?? 168) * 60 * 60 * 1000).toISOString();
  const { data: execs, error } = await supabase
    .from("integration_action_executions")
    .select("id, org_id, issue_id, action_key, governance_trace_id, execution_status, created_at, attempt_count")
    .eq("org_id", orgId)
    .gte("created_at", since)
    .gte("attempt_count", MIN_ATTEMPTS_FOR_RETRY_LABEL);

  if (error) return { inserted: 0, skipped: 0, errors: [error.message] };

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of execs ?? []) {
    const ex = raw as ExecRow;
    const traceId = await resolveTraceIdForExecution(supabase, ex);
    if (!traceId) {
      skipped++;
      continue;
    }
    const disp = await dispositionForTrace(supabase, traceId);
    if (disp !== "ALLOW") {
      skipped++;
      continue;
    }
    if (!(await canApplyImplicitLabel(supabase, traceId))) {
      skipped++;
      continue;
    }
    if (await hasActiveLabelOfType(supabase, traceId, "IMPLICIT_REPEATED_RETRY_AFTER_DENIAL")) {
      skipped++;
      continue;
    }

    const { error: insErr } = await insertGovernanceLabel(supabase, {
      trace_id: traceId,
      org_id: orgId,
      label_type: "IMPLICIT_REPEATED_RETRY_AFTER_DENIAL",
      label_source: "IMPLICIT",
      confidence: ex.governance_trace_id ? 0.72 : 0.55,
      rationale: `attempt_count=${ex.attempt_count ?? 0} status=${ex.execution_status} execution=${ex.id} (inferred: retry burden after allow)`,
    });
    if (insErr) errors.push(insErr.message);
    else inserted++;
  }

  return { inserted, skipped, errors };
}

export async function deriveAllImplicitLabels(
  supabase: SupabaseClient,
  orgId: string,
  options?: { sinceHours?: number }
): Promise<{
  approvalLatency: ImplicitDerivationResult;
  executionFailedAfterAllow: ImplicitDerivationResult;
  deadLetterBurden: ImplicitDerivationResult;
  repeatedRetryAfterAllow: ImplicitDerivationResult;
}> {
  const [approvalLatency, executionFailedAfterAllow, deadLetterBurden, repeatedRetryAfterAllow] =
    await Promise.all([
      deriveImplicitLabelsFromApprovalLatency(supabase, orgId, options),
      deriveImplicitExecutionFailedAfterAllow(supabase, orgId, options),
      deriveImplicitDeadLetterBurden(supabase, orgId, options),
      deriveImplicitRepeatedRetryAfterAllow(supabase, orgId, options),
    ]);
  return {
    approvalLatency,
    executionFailedAfterAllow,
    deadLetterBurden,
    repeatedRetryAfterAllow,
  };
}
