/**
 * Phase 7 — Revenue timeline events repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RevenueTimelineEventRow = {
  id: string;
  org_id: string;
  issue_id: string | null;
  finding_id: string | null;
  workflow_run_id: string | null;
  primary_entity_type: string | null;
  primary_entity_id: string | null;
  category: string;
  event_type: string;
  headline: string;
  summary: string;
  amount: number | null;
  currency_code: string | null;
  value_type: string | null;
  actor_type: string;
  actor_user_id: string | null;
  source_module: string;
  source_ref_id: string | null;
  status: string | null;
  detail_payload_json: Record<string, unknown>;
  display_priority: number;
  event_time: string;
  created_at: string;
};

export async function insertTimelineEvent(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    issue_id?: string | null;
    finding_id?: string | null;
    workflow_run_id?: string | null;
    primary_entity_type?: string | null;
    primary_entity_id?: string | null;
    category: string;
    event_type: string;
    headline: string;
    summary: string;
    amount?: number | null;
    currency_code?: string | null;
    value_type?: string | null;
    actor_type: string;
    actor_user_id?: string | null;
    source_module: string;
    source_ref_id?: string | null;
    status?: string | null;
    detail_payload_json?: Record<string, unknown>;
    display_priority?: number;
    event_time: string;
  }
): Promise<{ data: RevenueTimelineEventRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    issue_id: input.issue_id ?? null,
    finding_id: input.finding_id ?? null,
    workflow_run_id: input.workflow_run_id ?? null,
    primary_entity_type: input.primary_entity_type ?? null,
    primary_entity_id: input.primary_entity_id ?? null,
    category: input.category,
    event_type: input.event_type,
    headline: input.headline,
    summary: input.summary,
    amount: input.amount ?? null,
    currency_code: input.currency_code ?? null,
    value_type: input.value_type ?? null,
    actor_type: input.actor_type,
    actor_user_id: input.actor_user_id ?? null,
    source_module: input.source_module,
    source_ref_id: input.source_ref_id ?? null,
    status: input.status ?? null,
    detail_payload_json: input.detail_payload_json ?? {},
    display_priority: input.display_priority ?? 50,
    event_time: input.event_time,
  };
  const { data, error } = await supabase
    .from("revenue_timeline_events")
    .insert(row as Record<string, unknown>)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as RevenueTimelineEventRow, error: null };
}

export async function listEventsByIssue(
  supabase: SupabaseClient,
  issueId: string,
  options?: { limit?: number }
): Promise<{ data: RevenueTimelineEventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("revenue_timeline_events")
    .select("*")
    .eq("issue_id", issueId)
    .order("event_time", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(options?.limit ?? 200);
  return { data: (data ?? []) as RevenueTimelineEventRow[], error: error as Error | null };
}

export async function listEventsByEntity(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  options?: { limit?: number }
): Promise<{ data: RevenueTimelineEventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("revenue_timeline_events")
    .select("*")
    .eq("primary_entity_type", entityType)
    .eq("primary_entity_id", entityId)
    .order("event_time", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100);
  return { data: (data ?? []) as RevenueTimelineEventRow[], error: error as Error | null };
}

export async function listEventsByOrg(
  supabase: SupabaseClient,
  orgId: string,
  options?: {
    limit?: number;
    minDisplayPriority?: number;
    windowStart?: string;
    windowEnd?: string;
  }
): Promise<{ data: RevenueTimelineEventRow[]; error: Error | null }> {
  let q = supabase
    .from("revenue_timeline_events")
    .select("*")
    .eq("org_id", orgId)
    .order("event_time", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.minDisplayPriority != null) {
    q = q.gte("display_priority", options.minDisplayPriority);
  }
  if (options?.windowStart) {
    q = q.gte("event_time", options.windowStart);
  }
  if (options?.windowEnd) {
    q = q.lte("event_time", options.windowEnd);
  }

  const { data, error } = await q;
  return { data: (data ?? []) as RevenueTimelineEventRow[], error: error as Error | null };
}
