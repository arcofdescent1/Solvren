import type { SupabaseClient } from "@supabase/supabase-js";
import { insertVerificationRun, updateVerificationRun } from "../infrastructure/VerificationRepository";

export type VerificationType = "rule_recheck" | "integration_probe" | "manual_attestation" | "metric_delta";

export async function startVerificationRun(
  supabase: SupabaseClient,
  issueId: string,
  verificationType: VerificationType,
  triggeredBy: string | null
): Promise<{ runId: string | null; error?: string }> {
  const { data, error } = await insertVerificationRun(supabase, {
    issue_id: issueId,
    verification_type: verificationType,
    status: "running",
    triggered_by: triggeredBy,
  });
  if (error || !data) return { runId: null, error: (error as Error)?.message ?? "Insert failed" };
  return { runId: data.id };
}

export async function completeVerificationRun(
  supabase: SupabaseClient,
  runId: string,
  passed: boolean,
  resultSummary?: string | null
): Promise<{ error?: string }> {
  const now = new Date().toISOString();
  const { error } = await updateVerificationRun(supabase, runId, {
    status: passed ? "passed" : "failed",
    completed_at: now,
    result_summary: resultSummary ?? null,
  });
  if (error) return { error: (error as Error).message };
  return {};
}

export async function attestVerification(
  supabase: SupabaseClient,
  issueId: string,
  userId: string,
  resultSummary?: string | null
): Promise<{ runId: string | null; error?: string }> {
  const { data: run, error: runErr } = await insertVerificationRun(supabase, {
    issue_id: issueId,
    verification_type: "manual_attestation",
    status: "passed",
    triggered_by: userId,
  });
  if (runErr || !run) return { runId: null, error: (runErr as Error)?.message ?? "Insert failed" };

  const now = new Date().toISOString();
  await updateVerificationRun(supabase, run.id, {
    status: "passed",
    completed_at: now,
    result_summary: resultSummary ?? "Manual attestation",
  });

  const { error: updateIssueErr } = await supabase
    .from("issues")
    .update({
      verification_status: "passed",
      verified_at: now,
      status: "verified",
      updated_at: now,
    })
    .eq("id", issueId);
  if (updateIssueErr) return { runId: run.id, error: (updateIssueErr as Error).message };
  return { runId: run.id };
}
