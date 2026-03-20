/**
 * Phase 0 — Issues module: application use cases.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateIssueInput,
  Issue,
  IssueListParams,
} from "../domain";
import {
  canTriage,
  canAssign,
  canStart,
  canResolve,
  canDismiss,
  canReopen,
} from "../domain/validators";
import {
  getNextIssueKey,
  insertIssue,
  selectIssues,
  selectIssueById,
  insertIssueHistory,
  updateIssue,
  insertIssueComment,
} from "../infrastructure";
import type {
  TriageIssueInput,
  AssignIssueInput,
  ResolveIssueInput,
  DismissIssueInput,
  ReopenIssueInput,
} from "../api/schemas";
import type { IssueStatusUpdate } from "../infrastructure";

export type ListIssuesResult = { issues: Issue[]; error?: string };
export type IssueDetailResult = { issue: Issue | null; error?: string };

export async function createIssueFromSource(
  supabase: SupabaseClient,
  input: CreateIssueInput
): Promise<{ issue: Issue | null; error?: string }> {
  const issueKey = await getNextIssueKey(supabase, input.org_id);
  const { data, error } = await insertIssue(supabase, {
    ...input,
    issue_key: issueKey,
  });
  if (error) return { issue: null, error: (error as Error).message };
  if (!data) return { issue: null, error: "Insert did not return row" };
  return { issue: data as Issue, error: undefined };
}

export async function listIssues(
  supabase: SupabaseClient,
  params: IssueListParams
): Promise<ListIssuesResult> {
  const { data, error } = await selectIssues(supabase, params);
  if (error) return { issues: [], error: (error as Error).message };
  return { issues: data as Issue[], error: undefined };
}

export async function getIssueDetail(
  supabase: SupabaseClient,
  issueId: string
): Promise<IssueDetailResult> {
  const { data, error } = await selectIssueById(supabase, issueId);
  if (error) return { issue: null, error: (error as Error).message };
  return { issue: data as Issue | null, error: undefined };
}

export async function appendIssueHistory(
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
): Promise<{ error?: string }> {
  const { error } = await insertIssueHistory(supabase, payload);
  if (error) return { error: (error as Error).message };
  return {};
}

const now = () => new Date().toISOString();

export async function triageIssue(
  supabase: SupabaseClient,
  issueId: string,
  actorUserId: string,
  input: TriageIssueInput
): Promise<{ issue: Issue | null; error?: string }> {
  const { data: issue, error: fetchErr } = await selectIssueById(supabase, issueId);
  if (fetchErr || !issue) return { issue: null, error: fetchErr?.message ?? "Not found" };
  if (!canTriage(issue as Issue)) return { issue: null, error: "Issue cannot be triaged from current status" };
  const update: IssueStatusUpdate = {
    status: "triaged",
    triaged_at: now(),
    updated_at: now(),
  };
  if (input.domainKey != null) update.domain_key = input.domainKey;
  if (input.severity != null) update.severity = input.severity;
  if (input.priorityScore != null) update.priority_score = input.priorityScore;
  if (input.summary != null) update.summary = input.summary;
  const { data: updated, error: updateErr } = await updateIssue(supabase, issueId, update);
  if (updateErr || !updated) return { issue: null, error: updateErr?.message ?? "Update failed" };
  await insertIssueHistory(supabase, {
    issue_id: issueId,
    event_type: "triaged",
    event_actor_type: "user",
    event_actor_ref: actorUserId,
    new_state_json: update as Record<string, unknown>,
    metadata_json: input as Record<string, unknown>,
  });
  return { issue: updated as Issue, error: undefined };
}

export async function assignIssue(
  supabase: SupabaseClient,
  issueId: string,
  actorUserId: string,
  input: AssignIssueInput
): Promise<{ issue: Issue | null; error?: string }> {
  const { data: issue, error: fetchErr } = await selectIssueById(supabase, issueId);
  if (fetchErr || !issue) return { issue: null, error: fetchErr?.message ?? "Not found" };
  if (!canAssign(issue as Issue)) return { issue: null, error: "Issue cannot be assigned from current status" };
  const update = {
    status: "assigned" as const,
    owner_user_id: input.ownerUserId ?? null,
    owner_team_key: input.ownerTeamKey ?? null,
    assigned_at: now(),
    updated_at: now(),
  };
  const { data: updated, error: updateErr } = await updateIssue(supabase, issueId, update);
  if (updateErr || !updated) return { issue: null, error: updateErr?.message ?? "Update failed" };
  await insertIssueHistory(supabase, {
    issue_id: issueId,
    event_type: "assigned",
    event_actor_type: "user",
    event_actor_ref: actorUserId,
    new_state_json: update as Record<string, unknown>,
    metadata_json: { routingRationale: input.routingRationale },
  });
  return { issue: updated as Issue, error: undefined };
}

export async function startIssueWork(
  supabase: SupabaseClient,
  issueId: string,
  actorUserId: string
): Promise<{ issue: Issue | null; error?: string }> {
  const { data: issue, error: fetchErr } = await selectIssueById(supabase, issueId);
  if (fetchErr || !issue) return { issue: null, error: fetchErr?.message ?? "Not found" };
  if (!canStart(issue as Issue)) return { issue: null, error: "Issue cannot be started from current status" };
  const update = { status: "in_progress" as const, in_progress_at: now(), updated_at: now() };
  const { data: updated, error: updateErr } = await updateIssue(supabase, issueId, update);
  if (updateErr || !updated) return { issue: null, error: updateErr?.message ?? "Update failed" };
  await insertIssueHistory(supabase, {
    issue_id: issueId,
    event_type: "started",
    event_actor_type: "user",
    event_actor_ref: actorUserId,
    new_state_json: update as Record<string, unknown>,
  });
  return { issue: updated as Issue, error: undefined };
}

export async function resolveIssue(
  supabase: SupabaseClient,
  issueId: string,
  actorUserId: string,
  input: ResolveIssueInput
): Promise<{ issue: Issue | null; error?: string }> {
  const { data: issue, error: fetchErr } = await selectIssueById(supabase, issueId);
  if (fetchErr || !issue) return { issue: null, error: fetchErr?.message ?? "Not found" };
  if (!canResolve(issue as Issue)) return { issue: null, error: "Issue cannot be resolved from current status" };
  const update = {
    status: "resolved" as const,
    resolved_at: now(),
    summary: (issue as Issue).summary ?? input.resolutionSummary,
    updated_at: now(),
  };
  const { data: updated, error: updateErr } = await updateIssue(supabase, issueId, update);
  if (updateErr || !updated) return { issue: null, error: updateErr?.message ?? "Update failed" };
  await insertIssueHistory(supabase, {
    issue_id: issueId,
    event_type: "resolved",
    event_actor_type: "user",
    event_actor_ref: actorUserId,
    new_state_json: update as Record<string, unknown>,
    metadata_json: {
      resolutionSummary: input.resolutionSummary,
      verificationType: input.verificationType,
      waiveVerification: input.waiveVerification,
    },
  });
  return { issue: updated as Issue, error: undefined };
}

export async function dismissIssue(
  supabase: SupabaseClient,
  issueId: string,
  actorUserId: string,
  input: DismissIssueInput
): Promise<{ issue: Issue | null; error?: string }> {
  const { data: issue, error: fetchErr } = await selectIssueById(supabase, issueId);
  if (fetchErr || !issue) return { issue: null, error: fetchErr?.message ?? "Not found" };
  if (!canDismiss(issue as Issue)) return { issue: null, error: "Issue cannot be dismissed from current status" };
  const update = {
    status: "dismissed" as const,
    dismissed_at: now(),
    closed_reason: input.reason,
    updated_at: now(),
  };
  const { data: updated, error: updateErr } = await updateIssue(supabase, issueId, update);
  if (updateErr || !updated) return { issue: null, error: updateErr?.message ?? "Update failed" };
  await insertIssueHistory(supabase, {
    issue_id: issueId,
    event_type: "dismissed",
    event_actor_type: "user",
    event_actor_ref: actorUserId,
    new_state_json: update as Record<string, unknown>,
    metadata_json: { reason: input.reason, notes: input.notes },
  });
  return { issue: updated as Issue, error: undefined };
}

export async function reopenIssue(
  supabase: SupabaseClient,
  issueId: string,
  actorUserId: string,
  input: ReopenIssueInput
): Promise<{ issue: Issue | null; error?: string }> {
  const { data: issue, error: fetchErr } = await selectIssueById(supabase, issueId);
  if (fetchErr || !issue) return { issue: null, error: fetchErr?.message ?? "Not found" };
  if (!canReopen(issue as Issue)) return { issue: null, error: "Issue cannot be reopened from current status" };
  const update = {
    status: "open" as const,
    verification_status: "failed" as const,
    reopen_count: ((issue as Issue).reopen_count ?? 0) + 1,
    resolved_at: null,
    verified_at: null,
    dismissed_at: null,
    closed_reason: null,
    updated_at: now(),
  };
  const { data: updated, error: updateErr } = await updateIssue(supabase, issueId, update);
  if (updateErr || !updated) return { issue: null, error: updateErr?.message ?? "Update failed" };
  await insertIssueHistory(supabase, {
    issue_id: issueId,
    event_type: "reopened",
    event_actor_type: "user",
    event_actor_ref: actorUserId,
    new_state_json: update as Record<string, unknown>,
    metadata_json: { reason: input.reason },
  });
  return { issue: updated as Issue, error: undefined };
}

export async function addIssueComment(
  supabase: SupabaseClient,
  issueId: string,
  authorUserId: string,
  body: string,
  visibility?: string
): Promise<{ error?: string }> {
  const { error } = await insertIssueComment(supabase, {
    issue_id: issueId,
    author_user_id: authorUserId,
    body,
    visibility,
  });
  if (error) return { error: (error as Error).message };
  await insertIssueHistory(supabase, {
    issue_id: issueId,
    event_type: "comment_added",
    event_actor_type: "user",
    event_actor_ref: authorUserId,
    metadata_json: { bodyLength: body.length },
  });
  return {};
}
