import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgPurgeRequestStatus, OrgPurgeRunStatus, OrgPurgeRunStepStatus, PurgeStepKey } from "./types";

export type OrgPurgeRequestRow = {
  id: string;
  target_org_id: string;
  target_org_name: string;
  status: OrgPurgeRequestStatus;
  legal_hold_active: boolean;
  reason: string;
  retention_exception_summary: Record<string, unknown>;
  requested_by_user_id: string;
  approved_by_user_id: string | null;
  scheduled_execute_at: string | null;
  last_dry_run_at: string | null;
  last_dry_run_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type OrgPurgeRequestInsert = Pick<
  OrgPurgeRequestRow,
  | "target_org_id"
  | "target_org_name"
  | "status"
  | "legal_hold_active"
  | "reason"
  | "retention_exception_summary"
  | "requested_by_user_id"
  | "approved_by_user_id"
  | "scheduled_execute_at"
>;

export async function insertPurgeRequest(
  admin: SupabaseClient,
  row: OrgPurgeRequestInsert
): Promise<{ data: OrgPurgeRequestRow | null; error: Error | null }> {
  const { data, error } = await admin.from("org_purge_requests").insert(row).select().single();
  return { data: data as OrgPurgeRequestRow | null, error: error as Error | null };
}

export async function getPurgeRequest(
  admin: SupabaseClient,
  id: string
): Promise<{ data: OrgPurgeRequestRow | null; error: Error | null }> {
  const { data, error } = await admin.from("org_purge_requests").select("*").eq("id", id).maybeSingle();
  return { data: data as OrgPurgeRequestRow | null, error: error as Error | null };
}

export async function listPurgeRequestsForOrg(
  admin: SupabaseClient,
  targetOrgId: string,
  limit = 20
): Promise<{ data: OrgPurgeRequestRow[]; error: Error | null }> {
  const { data, error } = await admin
    .from("org_purge_requests")
    .select("*")
    .eq("target_org_id", targetOrgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as OrgPurgeRequestRow[], error: error as Error | null };
}

export async function updatePurgeRequest(
  admin: SupabaseClient,
  id: string,
  patch: Partial<OrgPurgeRequestRow>
): Promise<{ error: Error | null }> {
  const { error } = await admin.from("org_purge_requests").update(patch).eq("id", id);
  return { error: error as Error | null };
}

export async function insertPurgeRun(
  admin: SupabaseClient,
  row: {
    request_id: string;
    target_org_id: string;
    status: OrgPurgeRunStatus;
    actor_user_id: string | null;
  }
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data, error } = await admin.from("org_purge_runs").insert(row).select("id").single();
  return { data: data as { id: string } | null, error: error as Error | null };
}

export async function updatePurgeRun(
  admin: SupabaseClient,
  id: string,
  patch: {
    status?: OrgPurgeRunStatus;
    completed_at?: string | null;
    summary_json?: Record<string, unknown> | null;
    verification_json?: Record<string, unknown> | null;
    error_message?: string | null;
  }
): Promise<{ error: Error | null }> {
  const { error } = await admin.from("org_purge_runs").update(patch).eq("id", id);
  return { error: error as Error | null };
}

export async function getPurgeRun(
  admin: SupabaseClient,
  id: string
): Promise<{ data: Record<string, unknown> | null; error: Error | null }> {
  const { data, error } = await admin.from("org_purge_runs").select("*").eq("id", id).maybeSingle();
  return { data, error: error as Error | null };
}

export async function listPurgeRunSteps(
  admin: SupabaseClient,
  runId: string
): Promise<{ data: { step_key: string; status: OrgPurgeRunStepStatus; detail_json: Record<string, unknown> }[]; error: Error | null }> {
  const { data, error } = await admin
    .from("org_purge_run_steps")
    .select("step_key,status,detail_json")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  return { data: (data ?? []) as never, error: error as Error | null };
}

export async function markPurgeRunStepRunning(
  admin: SupabaseClient,
  runId: string,
  stepKey: PurgeStepKey
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { data: existing, error: selErr } = await admin
    .from("org_purge_run_steps")
    .select("id")
    .eq("run_id", runId)
    .eq("step_key", stepKey)
    .maybeSingle();
  if (selErr) return { error: selErr as Error };
  if (existing) {
    const { error } = await admin
      .from("org_purge_run_steps")
      .update({
        status: "running",
        error: null,
        started_at: now,
        detail_json: {},
      })
      .eq("id", (existing as { id: string }).id);
    return { error: error as Error | null };
  }
  const { error } = await admin.from("org_purge_run_steps").insert({
    run_id: runId,
    step_key: stepKey,
    status: "running",
    started_at: now,
    detail_json: {},
    error: null,
    completed_at: null,
  });
  return { error: error as Error | null };
}

export async function markPurgeRunStepFinished(
  admin: SupabaseClient,
  runId: string,
  stepKey: PurgeStepKey,
  input: {
    status: "completed" | "failed";
    detail_json: Record<string, unknown>;
    error?: string | null;
  }
): Promise<{ error: Error | null }> {
  const { error } = await admin
    .from("org_purge_run_steps")
    .update({
      status: input.status,
      detail_json: input.detail_json,
      error: input.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("run_id", runId)
    .eq("step_key", stepKey);
  return { error: error as Error | null };
}
