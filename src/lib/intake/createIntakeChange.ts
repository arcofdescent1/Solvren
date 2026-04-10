import type { SupabaseClient } from "@supabase/supabase-js";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { auditLog } from "@/lib/audit";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { resolveApprovalRoleSuggestions } from "@/services/approvals/roleMapping";
import type { IntakeRecordType } from "@/lib/intake/intakeMapping";
import { intakeDomainAndChangeType, mapUserSeverityToRiskBucket } from "@/lib/intake/intakeMapping";
import type { TimelineEventType } from "@/services/timeline/addTimelineEvent";

export type CreateIntakeChangeParams = {
  supabase: SupabaseClient;
  orgId: string;
  actorUserId: string;
  actorEmail?: string | null;
  title: string;
  description?: string;
  intakeRecordType: IntakeRecordType;
  sourceMode: "MANUAL" | "SPREADSHEET" | "CUSTOM" | "NATIVE";
  sourceLabel?: string | null;
  sourceReference?: string | null;
  intakeMetadataJson?: Record<string, unknown>;
  /** Imported / user-selected severity (caps assessment initial bucket). */
  severity?: string | null;
  timelineEventType: TimelineEventType;
  timelineTitle: string;
  timelineDescription?: string | null;
  timelineMetadata?: Record<string, unknown>;
  auditAction: string;
};

export async function createIntakeChange(
  p: CreateIntakeChangeParams
): Promise<{ changeEventId: string }> {
  const { domain, change_type } = intakeDomainAndChangeType(p.intakeRecordType);
  const riskBucket = mapUserSeverityToRiskBucket(p.severity);
  const title = (p.title || "Untitled").slice(0, 500);
  const intake = { description: p.description ?? "" };

  const { data: change, error } = await p.supabase
    .from("change_events")
    .insert({
      org_id: p.orgId,
      title,
      change_type,
      status: "DRAFT",
      domain,
      systems_involved: [],
      revenue_impact_areas: [],
      intake,
      created_by: p.actorUserId,
      source_mode: p.sourceMode,
      intake_record_type: p.intakeRecordType,
      source_label: p.sourceLabel ?? null,
      source_reference: p.sourceReference ?? null,
      intake_metadata_json: p.intakeMetadataJson ?? {},
    })
    .select("id")
    .single();

  if (error || !change) throw new Error(error?.message ?? "Failed to create change");

  const changeEventId = change.id as string;

  const { error: iaErr } = await p.supabase.from("impact_assessments").insert({
    change_event_id: changeEventId,
    domain,
    status: "PENDING",
    schema_version: "pass_a_v1",
    risk_bucket: riskBucket,
  });
  if (iaErr) throw new Error(iaErr.message ?? "Failed to create assessment");

  await addTimelineEvent({
    supabase: p.supabase,
    orgId: p.orgId,
    changeEventId,
    actorUserId: p.actorUserId,
    eventType: p.timelineEventType,
    title: p.timelineTitle,
    description: p.timelineDescription ?? null,
    metadata: p.timelineMetadata ?? {},
  });

  await auditLog(p.supabase, {
    orgId: p.orgId,
    actorId: p.actorUserId,
    actorType: "USER",
    action: p.auditAction,
    entityType: "change",
    entityId: changeEventId,
    metadata: { intake_record_type: p.intakeRecordType, source_mode: p.sourceMode },
  });

  try {
    const admin = createPrivilegedClient("createIntakeChange: resolveApprovalRoleSuggestions");
    const resolved = await resolveApprovalRoleSuggestions(admin, {
      orgId: p.orgId,
      domain,
      systems: [],
      changeType: change_type,
    });
    await auditLog(admin, {
      orgId: p.orgId,
      actorId: p.actorUserId,
      actorType: "USER",
      action: "approval_mapping_evaluated",
      entityType: "change",
      entityId: changeEventId,
      metadata: {
        suggested_roles: resolved.suggestions.map((s) => s.roleName),
        suggested_users: resolved.suggestedUserIds.length,
        warnings: resolved.warnings,
      },
    });
  } catch {
    // best effort
  }

  return { changeEventId };
}
