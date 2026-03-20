/**
 * Phase 1 — Append-only lifecycle events repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { IssueLifecycleEventType } from "../domain";
import type { LifecycleActorType } from "../domain/lifecycle-context";

export type LifecycleEventRow = {
  id: string;
  org_id: string;
  issue_id: string;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  event_reason: string | null;
  event_payload_json: Record<string, unknown>;
  actor_type: string;
  actor_user_id: string | null;
  correlation_id: string | null;
  created_at: string;
};

export type InsertLifecycleEventInput = {
  org_id: string;
  issue_id: string;
  event_type: IssueLifecycleEventType | string;
  from_state?: string | null;
  to_state?: string | null;
  event_reason?: string | null;
  event_payload_json?: Record<string, unknown>;
  actor_type: LifecycleActorType;
  actor_user_id?: string | null;
  correlation_id?: string | null;
};

export async function insertLifecycleEvent(
  supabase: SupabaseClient,
  input: InsertLifecycleEventInput
): Promise<{ data: LifecycleEventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issue_lifecycle_events")
    .insert({
      org_id: input.org_id,
      issue_id: input.issue_id,
      event_type: input.event_type,
      from_state: input.from_state ?? null,
      to_state: input.to_state ?? null,
      event_reason: input.event_reason ?? null,
      event_payload_json: input.event_payload_json ?? {},
      actor_type: input.actor_type,
      actor_user_id: input.actor_user_id ?? null,
      correlation_id: input.correlation_id ?? null,
    })
    .select()
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as LifecycleEventRow, error: null };
}

export async function listLifecycleEvents(
  supabase: SupabaseClient,
  issueId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ data: LifecycleEventRow[]; error: Error | null }> {
  const limit = Math.min(options?.limit ?? 100, 500);
  const offset = options?.offset ?? 0;
  const { data, error } = await supabase
    .from("issue_lifecycle_events")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return { data: [], error: error as unknown as Error };
  return { data: (data ?? []) as LifecycleEventRow[], error: null };
}
