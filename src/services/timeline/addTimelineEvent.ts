import type { SupabaseClient } from "@supabase/supabase-js";

export type TimelineEventType =
  | "CHANGE_CREATED"
  | "CHANGE_UPDATED"
  | "CHANGE_SUBMITTED"
  | "CHANGE_REOPENED"
  | "CHANGE_APPROVED"
  | "CHANGE_REJECTED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_APPROVED"
  | "APPROVAL_REJECTED"
  | "APPROVAL_APPROVED_FROM_SLACK"
  | "APPROVAL_REJECTED_FROM_SLACK"
  | "APPROVAL_DELEGATED_FROM_SLACK"
  | "APPROVAL_DEFERRED_FROM_SLACK"
  | "APPROVAL_INFO_REQUESTED_FROM_SLACK"
  | "APPROVAL_COMMENT_ADDED"
  | "EVIDENCE_REQUIRED"
  | "EVIDENCE_PROVIDED"
  | "EVIDENCE_UPDATED"
  | "EVIDENCE_WAIVED"
  | "APPROVERS_ASSIGNED"
  | "DOMAIN_ASSIGNED"
  | "SYSTEMS_UPDATED"
  | "COMMENT_ADDED"
  | "REVENUE_IMPACT_REPORT_GENERATED"
  | "REVENUE_IMPACT_REPORT_REGENERATED"
  | "REVENUE_IMPACT_REPORT_FAILED"
  | "REVENUE_IMPACT_REPORT_MARKED_STALE"
  | "COORDINATION_PLAN_GENERATED"
  | "COORDINATION_PLAN_REGENERATED"
  | "COORDINATION_PLAN_MARKED_STALE"
  | "COORDINATION_APPROVERS_APPLIED"
  | "COORDINATION_EVIDENCE_APPLIED"
  | "COORDINATION_BLOCKER_DETECTED"
  | "COORDINATION_OVERRIDE_DETECTED"
  | "EXECUTIVE_DECISION"
  | "MANUAL_INTAKE_CREATED"
  | "SPREADSHEET_IMPORT_COMMITTED"
  | "CUSTOM_SOURCE_RECORD_INGESTED"
  | "SOURCE_MAPPING_UPDATED"
  | "SOURCE_SECRET_ROTATED";

export type AddTimelineEventParams = {
  supabase: SupabaseClient;
  orgId: string;
  changeEventId: string;
  actorUserId?: string | null;
  eventType: TimelineEventType;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export async function addTimelineEvent(params: AddTimelineEventParams): Promise<void> {
  const {
    supabase,
    orgId,
    changeEventId,
    actorUserId = null,
    eventType,
    title,
    description = null,
    metadata = {},
  } = params;

  const { error } = await supabase.from("change_timeline_events").insert({
    org_id: orgId,
    change_event_id: changeEventId,
    actor_user_id: actorUserId,
    event_type: eventType,
    title,
    description,
    metadata,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.warn("change_timeline_events insert failed:", error.message);
  }
}
