/**
 * Phase 6 — Record external action result (§14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateExecutionTask } from "../persistence/execution-tasks.repository";

export type RecordExternalActionResultInput = {
  taskId: string;
  externalTaskId: string | null;
  status: "done" | "failed" | "in_progress";
  syncStatus?: "synced" | "failed" | "pending";
};

export async function recordExternalActionResult(
  supabase: SupabaseClient,
  input: RecordExternalActionResultInput
): Promise<{ error: string | null }> {
  const { error } = await updateExecutionTask(supabase, input.taskId, {
    external_task_id: input.externalTaskId ?? undefined,
    status: input.status,
    sync_status: input.syncStatus,
  });
  return { error: error?.message ?? null };
}
