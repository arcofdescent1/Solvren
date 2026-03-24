/**
 * Phase 3 — Replay orchestrator.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseScope, resolveRecordsToReplay, type ReplayScope } from "./replayScopeResolver";
import { replaySingleEvent } from "./replayExecutor";

export type StartReplayInput = {
  orgId: string;
  integrationAccountId?: string | null;
  scopeType: string;
  scopeJson: Record<string, unknown>;
  requestedBy: string;
  safeReprocess?: boolean;
};

export async function startReplay(
  supabase: SupabaseClient,
  input: StartReplayInput
): Promise<{ replayJobId: string; status: "queued" | "running"; error?: string }> {
  const scopeResult = parseScope(input.scopeType, input.scopeJson);
  if ("error" in scopeResult) {
    return { replayJobId: "", status: "queued", error: scopeResult.error };
  }

  const { data: job, error: insertErr } = await supabase
    .from("integration_replay_jobs")
    .insert({
      org_id: input.orgId,
      integration_account_id: input.integrationAccountId ?? null,
      scope_type: input.scopeType,
      scope_json: input.scopeJson,
      status: "queued",
      requested_by: input.requestedBy,
    })
    .select("id")
    .single();

  if (insertErr || !job) {
    return { replayJobId: "", status: "queued", error: insertErr?.message ?? "Failed to create replay job" };
  }

  const jobId = (job as { id: string }).id;

  const resolved = await resolveRecordsToReplay(supabase, scopeResult);
  if (resolved.error && resolved.rawEventIds.length === 0) {
    await supabase
      .from("integration_replay_jobs")
      .update({ status: "failed", error_json: { message: resolved.error }, completed_at: new Date().toISOString() })
      .eq("id", jobId);
    return { replayJobId: jobId, status: "queued", error: resolved.error };
  }

  await supabase
    .from("integration_replay_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  const options = {
    replayJobId: jobId,
    replayReason: `Replay scope: ${input.scopeType}`,
    replayActor: input.requestedBy,
    safeReprocess: input.safeReprocess ?? true,
  };

  let successCount = 0;
  let failCount = 0;
  for (const rawEventId of resolved.rawEventIds) {
    const res = await replaySingleEvent(supabase, {
      rawEventId,
      orgId: input.orgId,
      provider: (input.scopeJson.provider as string) ?? "unknown",
      options,
    });
    if (res.ok) successCount++;
    else failCount++;
  }

  await supabase
    .from("integration_replay_jobs")
    .update({
      status: failCount > 0 && successCount === 0 ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      result_json: { successCount, failCount, total: resolved.rawEventIds.length },
    })
    .eq("id", jobId);

  return { replayJobId: jobId, status: "running" };
}
