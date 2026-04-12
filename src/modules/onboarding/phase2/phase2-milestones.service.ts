/**
 * Phase 2 — milestone evaluation, denormalized counters, and completion transitions.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "../repositories/org-onboarding-states.repository";
import { phase2AnalyticsBase } from "./phase2-analytics-payload";
import { ACTIVATION_POLICY_KEY_PREFIX } from "./policy-templates";

async function getPrimaryOwnerUserId(admin: SupabaseClient, orgId: string): Promise<string | null> {
  const { data: owners } = await admin
    .from("organization_members")
    .select("user_id, created_at")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1);
  const o = owners?.[0] as { user_id?: string } | undefined;
  if (o?.user_id) return String(o.user_id);
  const { data: first } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return first ? String((first as { user_id: string }).user_id) : null;
}

export async function countMembersExcludingOwner(admin: SupabaseClient, orgId: string): Promise<number> {
  const ownerId = await getPrimaryOwnerUserId(admin, orgId);
  if (!ownerId) {
    const { count } = await admin.from("organization_members").select("user_id", { count: "exact", head: true }).eq("org_id", orgId);
    return Math.max(0, (count ?? 0) - 1);
  }
  const { count } = await admin
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .neq("user_id", ownerId);
  return count ?? 0;
}

export async function countEnabledDetectorWorkflows(admin: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await admin
    .from("detector_configs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("enabled", true);
  return count ?? 0;
}

export async function countNotificationPreferences(admin: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await admin
    .from("org_notification_preferences")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("enabled", true);
  return count ?? 0;
}

export async function countActivationPolicies(admin: SupabaseClient, orgId: string): Promise<number> {
  const base = admin
    .from("policies")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active")
    .like("policy_key", `${ACTIVATION_POLICY_KEY_PREFIX}%`);
  const { count, error } = await base.is("archived_at", null);
  if (error) {
    const { count: c2 } = await admin
      .from("policies")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active")
      .like("policy_key", `${ACTIVATION_POLICY_KEY_PREFIX}%`);
    return c2 ?? 0;
  }
  return count ?? 0;
}

export async function findFirstDeliveredAlert(admin: SupabaseClient, orgId: string): Promise<{ at: string; channel: string } | null> {
  const { data } = await admin
    .from("notification_outbox")
    .select("created_at, channel, delivered_at, sent_at")
    .eq("org_id", orgId)
    .or("delivered_at.not.is.null,sent_at.not.is.null")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const r = data as { created_at?: string; channel?: string; delivered_at?: string | null; sent_at?: string | null } | null;
  if (!r) return null;
  const at = r.delivered_at ?? r.sent_at ?? r.created_at;
  if (!at) return null;
  return { at, channel: r.channel ?? "unknown" };
}

type OpEvent = { type: string; id: string; at: string };

async function findFirstOperationalEvent(admin: SupabaseClient, orgId: string): Promise<OpEvent | null> {
  const candidates: OpEvent[] = [];

  const { data: issue } = await admin
    .from("issues")
    .select("id, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (issue) {
    const i = issue as { id: string; created_at: string };
    candidates.push({ type: "issue_detected", id: i.id, at: i.created_at });
  }

  const { data: apprRow } = await admin
    .from("approvals")
    .select("id, change_event_id")
    .eq("org_id", orgId)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (apprRow) {
    const a = apprRow as { id: string; change_event_id: string };
    const { data: ce } = await admin.from("change_events").select("created_at").eq("id", a.change_event_id).maybeSingle();
    const at = (ce as { created_at?: string } | null)?.created_at ?? new Date().toISOString();
    candidates.push({ type: "approval_request_created", id: a.id, at });
  }

  const { data: wr } = await admin
    .from("workflow_runs")
    .select("id, started_at")
    .eq("org_id", orgId)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (wr) {
    const w = wr as { id: string; started_at: string };
    candidates.push({ type: "workflow_rule_triggered", id: w.id, at: w.started_at });
  }

  const { data: nx } = await admin
    .from("notification_outbox")
    .select("id, created_at, delivered_at, sent_at")
    .eq("org_id", orgId)
    .or("delivered_at.not.is.null,sent_at.not.is.null")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nx) {
    const n = nx as { id: string; created_at: string; delivered_at?: string | null; sent_at?: string | null };
    const at = n.delivered_at ?? n.sent_at ?? n.created_at;
    candidates.push({ type: "alert_delivered", id: n.id, at });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return candidates[0] ?? null;
}

export type Phase2MilestoneFlags = {
  teamOk: boolean;
  workflowOk: boolean;
  alertDeliveredOk: boolean;
  approvalOk: boolean;
  operationalOk: boolean;
  allComplete: boolean;
};

export async function evaluatePhase2Milestones(admin: SupabaseClient, orgId: string): Promise<Phase2MilestoneFlags> {
  const membersExcl = await countMembersExcludingOwner(admin, orgId);
  const workflows = await countEnabledDetectorWorkflows(admin, orgId);
  const policiesN = await countActivationPolicies(admin, orgId);
  const delivered = await findFirstDeliveredAlert(admin, orgId);
  const op = await findFirstOperationalEvent(admin, orgId);

  const teamOk = membersExcl >= 2;
  const workflowOk = workflows >= 1;
  const alertDeliveredOk = !!delivered;
  const approvalOk = policiesN >= 1;
  const operationalOk = !!op;

  return {
    teamOk,
    workflowOk,
    alertDeliveredOk,
    approvalOk,
    operationalOk,
    allComplete: teamOk && workflowOk && alertDeliveredOk && approvalOk && operationalOk,
  };
}

export async function syncPhase2ProgressToOrgState(orgId: string): Promise<{ flags: Phase2MilestoneFlags; error: Error | null }> {
  const admin = createAdminClient();
  const { data: row } = await getOrgOnboardingState(admin, orgId);
  const flags = await evaluatePhase2Milestones(admin, orgId);

  const membersExcl = await countMembersExcludingOwner(admin, orgId);
  const workflows = await countEnabledDetectorWorkflows(admin, orgId);
  const notifPrefs = await countNotificationPreferences(admin, orgId);
  const policiesN = await countActivationPolicies(admin, orgId);
  const delivered = await findFirstDeliveredAlert(admin, orgId);
  const op = await findFirstOperationalEvent(admin, orgId);

  const patch: Parameters<typeof upsertOrgOnboardingState>[1] = {
    orgId,
    acceptedMemberCountExcludingOwner: membersExcl,
    enabledWorkflowCount: workflows,
    configuredAlertChannelCount: notifPrefs,
    configuredApprovalRuleCount: policiesN,
  };

  if (delivered) {
    patch.firstAlertDeliveredAt = delivered.at;
    patch.firstAlertDeliveryChannel = delivered.channel;
  }
  if (op) {
    patch.firstOperationalEventAt = op.at;
    patch.firstOperationalEventType = op.type;
    patch.firstOperationalEventId = op.id;
  }

  const completedTransition = Boolean(flags.allComplete && row?.phase2_status !== "COMPLETED");
  if (completedTransition) {
    patch.phase2Status = "COMPLETED";
    patch.phase2CompletedAt = new Date().toISOString();
    patch.phase2CurrentStep = "first_live_result";
  }

  const curStep = row?.phase2_current_step ?? "team_setup";
  if (curStep === "team_setup" && flags.teamOk && row?.phase2_status !== "COMPLETED") {
    patch.phase2CurrentStep = "risk_priorities";
  }

  const { error } = await upsertOrgOnboardingState(admin, patch);
  if (!error && completedTransition) {
    await trackServerAppEvent(admin, {
      orgId,
      userId: null,
      event: "onboarding_phase2_completed",
      properties: phase2AnalyticsBase(orgId, "COMPLETED", "first_live_result"),
    });
  }
  return { flags, error };
}
