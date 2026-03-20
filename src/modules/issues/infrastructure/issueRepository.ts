/**
 * Phase 0 — Issues module: infrastructure repository.
 * Supabase-backed issue persistence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Issue, CreateIssueInput, IssueListParams } from "../domain";
import type { IssueRow } from "./types";

export type { IssueRow };

export async function getNextIssueKey(
  supabase: SupabaseClient,
  orgId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("next_issue_key", {
    p_org_id: orgId,
  });
  if (!error && typeof data === "string") return data;
  // Fallback: compute from max issue_key in app
  const { data: rows } = await supabase
    .from("issues")
    .select("issue_key")
    .eq("org_id", orgId)
    .like("issue_key", "ISS-%")
    .order("id", { ascending: false })
    .limit(100);
  let maxNum = 0;
  const re = /^ISS-(\d+)$/;
  for (const r of rows ?? []) {
    const m = re.exec(String(r.issue_key ?? ""));
    if (m) maxNum = Math.max(maxNum, parseInt(m[1]!, 10));
  }
  return "ISS-" + String(maxNum + 1).padStart(6, "0");
}

export async function insertIssue(
  supabase: SupabaseClient,
  input: CreateIssueInput & { issue_key: string }
): Promise<{ data: IssueRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    issue_key: input.issue_key,
    source_type: input.source_type,
    source_ref: input.source_ref,
    source_event_time: input.source_event_time ?? null,
    domain_key: input.domain_key,
    title: input.title,
    description: input.description ?? null,
    summary: input.summary ?? null,
    severity: input.severity ?? "medium",
    status: "open",
    verification_status: "pending",
    confidence_score: input.confidence_score ?? null,
    impact_score: input.impact_score ?? null,
    created_by: input.created_by ?? null,
    detector_key: input.detector_key ?? null,
    primary_entity_id: input.primary_entity_id ?? null,
    issue_type: input.issue_type ?? null,
    issue_subtype: input.issue_subtype ?? null,
    issue_confidence: input.issue_confidence ?? null,
  };
  const { data, error } = await supabase
    .from("issues")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error };
  return { data: data as IssueRow, error: null };
}

export async function selectIssues(
  supabase: SupabaseClient,
  params: IssueListParams
): Promise<{ data: IssueRow[]; error: Error | null }> {
  let q = supabase
    .from("issues")
    .select("*")
    .eq("org_id", params.org_id)
    .order("opened_at", { ascending: false });
  if (params.status != null) {
    const arr = Array.isArray(params.status) ? params.status : [params.status];
    if (arr.length) q = q.in("status", arr);
  }
  if (params.source_type != null) {
    const arr = Array.isArray(params.source_type)
      ? params.source_type
      : [params.source_type];
    if (arr.length) q = q.in("source_type", arr);
  }
  if (params.severity != null) {
    const arr = Array.isArray(params.severity) ? params.severity : [params.severity];
    if (arr.length) q = q.in("severity", arr);
  }
  if (params.domain_key != null) q = q.eq("domain_key", params.domain_key);
  if (params.verification_status != null) {
    const arr = Array.isArray(params.verification_status)
      ? params.verification_status
      : [params.verification_status];
    if (arr.length) q = q.in("verification_status", arr);
  }
  if (params.owner_user_id != null) q = q.eq("owner_user_id", params.owner_user_id);
  const limit = Math.min(params.limit ?? 50, 100);
  const offset = params.offset ?? 0;
  q = q.range(offset, offset + limit - 1);
  const { data, error } = await q;
  if (error) return { data: [], error };
  return { data: (data ?? []) as IssueRow[], error: null };
}

export async function selectIssueById(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: IssueRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("id", issueId)
    .single();
  if (error) return { data: null, error };
  return { data: data as IssueRow, error: null };
}

export type IssueStatusUpdate = {
  status?: string;
  verification_status?: string;
  severity?: string;
  domain_key?: string;
  summary?: string | null;
  priority_score?: number | null;
  owner_user_id?: string | null;
  owner_team_key?: string | null;
  triaged_at?: string | null;
  assigned_at?: string | null;
  in_progress_at?: string | null;
  resolved_at?: string | null;
  verified_at?: string | null;
  dismissed_at?: string | null;
  closed_reason?: string | null;
  reopen_count?: number;
  updated_at?: string;
};

export async function updateIssue(
  supabase: SupabaseClient,
  issueId: string,
  update: IssueStatusUpdate
): Promise<{ data: IssueRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issues")
    .update({
      ...update,
      updated_at: update.updated_at ?? new Date().toISOString(),
    })
    .eq("id", issueId)
    .select()
    .single();
  if (error) return { data: null, error };
  return { data: data as IssueRow, error: null };
}

export async function insertIssueHistory(
  supabase: SupabaseClient,
  payload: {
    issue_id: string;
    event_type: string;
    event_actor_type?: string | null;
    event_actor_ref?: string | null;
    old_state_json?: Record<string, unknown> | null;
    new_state_json?: Record<string, unknown> | null;
    metadata_json?: Record<string, unknown>;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("issue_history").insert({
    issue_id: payload.issue_id,
    event_type: payload.event_type,
    event_actor_type: payload.event_actor_type ?? null,
    event_actor_ref: payload.event_actor_ref ?? null,
    old_state_json: payload.old_state_json ?? null,
    new_state_json: payload.new_state_json ?? null,
    metadata_json: payload.metadata_json ?? {},
  });
  return { error: error ?? null };
}

export async function insertIssueComment(
  supabase: SupabaseClient,
  payload: {
    issue_id: string;
    author_user_id: string;
    body: string;
    visibility?: string;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("issue_comments").insert({
    issue_id: payload.issue_id,
    author_user_id: payload.author_user_id,
    body: payload.body,
    visibility: payload.visibility ?? "internal",
  });
  return { error: error ?? null };
}
