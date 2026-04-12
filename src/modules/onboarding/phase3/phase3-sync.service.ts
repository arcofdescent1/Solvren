/**
 * Phase 3 — recompute cached milestone columns (sole source of truth for UI).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import {
  getOrgOnboardingState,
  upsertOrgOnboardingState,
  type OrgOnboardingStateRow,
} from "../repositories/org-onboarding-states.repository";
import { phase3AnalyticsBase } from "./phase3-analytics-payload";
import { meetsPhase3EntryConditions, isPhase3Terminal } from "./phase3-entry.service";
import { isExecutiveMembership } from "./phase3-executive";
import { PHASE3_STEPS, type Phase3StepKey } from "./phase3-constants";

function calendarDateInTimeZone(iso: string, timeZone: string): Date {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  const m = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
}

function isoWeekFromUtcDate(d: Date): string {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  const thursday = new Date(target);
  thursday.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function isoWeekKeyForInteraction(iso: string, timeZone: string): string {
  const cal = calendarDateInTimeZone(iso, timeZone);
  return isoWeekFromUtcDate(cal);
}

async function countConnectedIntegrations(admin: SupabaseClient, orgId: string): Promise<number> {
  const { data } = await admin
    .from("integration_connections")
    .select("provider")
    .eq("org_id", orgId)
    .eq("status", "connected");
  return new Set((data ?? []).map((r) => String((r as { provider: string }).provider))).size;
}

async function countEnabledWorkflows(admin: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await admin
    .from("detector_configs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("enabled", true);
  return count ?? 0;
}

async function getOrgTimezone(admin: SupabaseClient, orgId: string): Promise<string> {
  const { data } = await admin
    .from("org_executive_summary_preferences")
    .select("timezone")
    .eq("org_id", orgId)
    .maybeSingle();
  const tz = (data as { timezone?: string } | null)?.timezone;
  return tz && tz.trim() ? tz.trim() : "UTC";
}

async function pickFirstValueStoryId(
  admin: SupabaseClient,
  orgId: string,
  sinceIso: string
): Promise<string | null> {
  const { data: rows } = await admin
    .from("value_stories")
    .select("id, confidence_level, created_at")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso)
    .in("status", ["ACTIVE", "PENDING"])
    .limit(80);
  const list = (rows ?? []) as { id: string; confidence_level: string; created_at: string }[];
  if (list.length === 0) return null;
  const rank = (c: string) => {
    const u = c.toUpperCase();
    if (u === "VERIFIED") return 0;
    if (u === "HIGH_CONFIDENCE") return 1;
    if (u === "LIKELY") return 2;
    if (u === "ESTIMATED") return 3;
    return 4;
  };
  list.sort((a, b) => {
    const dr = rank(a.confidence_level) - rank(b.confidence_level);
    if (dr !== 0) return dr;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return list[0]?.id ?? null;
}

async function findFirstExecutiveFromAudit(admin: SupabaseClient, orgId: string) {
  const { data: auditRows } = await admin
    .from("audit_log")
    .select("actor_id, created_at")
    .eq("org_id", orgId)
    .eq("action", "executive_dashboard_view")
    .not("actor_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(80);
  for (const r of auditRows ?? []) {
    const actorId = String((r as { actor_id: string }).actor_id);
    const { data: mem } = await admin
      .from("organization_members")
      .select("role, department, title")
      .eq("org_id", orgId)
      .eq("user_id", actorId)
      .maybeSingle();
    const m = mem as { role?: string; department?: string; title?: string } | null;
    if (m && isExecutiveMembership({ role: m.role, department: m.department, title: m.title })) {
      return { at: (r as { created_at: string }).created_at, userId: actorId };
    }
  }
  return null;
}

async function findExecutiveSummaryDelivery(admin: SupabaseClient, orgId: string) {
  const { data: out } = await admin
    .from("notification_outbox")
    .select("id, created_at, delivered_at, sent_at, status")
    .eq("org_id", orgId)
    .eq("template_key", "executive_summary")
    .order("created_at", { ascending: true })
    .limit(20);
  for (const row of out ?? []) {
    const o = row as {
      created_at: string;
      delivered_at?: string | null;
      sent_at?: string | null;
      status?: string | null;
    };
    const delivered =
      o.delivered_at != null ||
      o.sent_at != null ||
      (o.status && ["SENT", "DELIVERED"].includes(String(o.status).toUpperCase()));
    if (!delivered) continue;
    const at = o.delivered_at ?? o.sent_at ?? o.created_at;
    const { data: execMembers } = await admin
      .from("organization_members")
      .select("user_id, role, department, title")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    for (const m of execMembers ?? []) {
      const u = m as { user_id: string; role?: string; department?: string; title?: string };
      if (isExecutiveMembership({ role: u.role, department: u.department, title: u.title })) {
        return { at, userId: u.user_id };
      }
    }
    return { at, userId: null as string | null };
  }
  return null;
}

async function resolveExecutiveEngagement(
  admin: SupabaseClient,
  orgId: string,
  row: { executive_engagement_at?: string | null; executive_engaged_user_id?: string | null }
) {
  if (row.executive_engagement_at && row.executive_engaged_user_id) {
    return { at: row.executive_engagement_at, userId: row.executive_engaged_user_id };
  }
  const fromAudit = await findFirstExecutiveFromAudit(admin, orgId);
  if (fromAudit) return fromAudit;
  const fromDigest = await findExecutiveSummaryDelivery(admin, orgId);
  if (fromDigest?.userId) return { at: fromDigest.at, userId: fromDigest.userId };
  if (fromDigest && !fromDigest.userId) {
    const { data: execMembers } = await admin
      .from("organization_members")
      .select("user_id, role, department, title")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    for (const m of execMembers ?? []) {
      const u = m as { user_id: string; role?: string; department?: string; title?: string };
      if (isExecutiveMembership({ role: u.role, department: u.department, title: u.title })) {
        return { at: fromDigest.at, userId: u.user_id };
      }
    }
  }
  return null;
}

async function countActiveDepartments(admin: SupabaseClient, orgId: string): Promise<number> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: members } = await admin
    .from("organization_members")
    .select("user_id, department")
    .eq("org_id", orgId)
    .not("department", "is", null)
    .neq("department", "");
  const byDept = new Map<string, Set<string>>();
  for (const m of members ?? []) {
    const row = m as { user_id: string; department: string };
    const d = row.department.trim();
    if (!d) continue;
    if (!byDept.has(d)) byDept.set(d, new Set());
    byDept.get(d)!.add(row.user_id);
  }
  let active = 0;
  for (const [, userIds] of byDept) {
    const ids = [...userIds];
    if (ids.length === 0) continue;
    const { count } = await admin
      .from("org_phase3_usage_interactions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", since)
      .in("user_id", ids);
    if ((count ?? 0) >= 1) active += 1;
  }
  return active;
}

function firstIncompleteStep(flags: {
  expansionOk: boolean;
  deptOk: boolean;
  execOk: boolean;
  valueOk: boolean;
  habitOk: boolean;
}): Phase3StepKey | null {
  if (!flags.expansionOk) return "expand_coverage";
  if (!flags.deptOk) return "invite_more_teams";
  if (!flags.execOk) return "executive_visibility";
  if (!flags.valueOk) return "prove_value";
  if (!flags.habitOk) return "build_habit";
  return null;
}

export type Phase3MilestoneFlags = {
  expansionOk: boolean;
  deptOk: boolean;
  execOk: boolean;
  valueOk: boolean;
  habitOk: boolean;
  allComplete: boolean;
};

/** Milestone flags from denormalized columns only (used when sync is a no-op). */
export function readCachedMilestoneFlagsFromRow(row: OrgOnboardingStateRow): Phase3MilestoneFlags {
  const expansionOk = (row.expanded_integration_count ?? 0) >= 2;
  const deptOk = (row.active_department_count ?? 0) >= 3;
  const execOk = !!(row.executive_engagement_at && row.executive_engaged_user_id);
  const valueOk = !!row.first_value_story_id;
  const habitOk = (row.phase3_usage_interaction_count ?? 0) >= 5 && (row.phase3_active_weeks ?? 0) >= 2;
  const allComplete = row.phase3_status === "COMPLETED";
  return { expansionOk, deptOk, execOk, valueOk, habitOk, allComplete };
}

export async function runPhase3Sync(orgId: string): Promise<{ flags: Phase3MilestoneFlags; error: Error | null }> {
  const admin = createAdminClient();
  const { data: row } = await getOrgOnboardingState(admin, orgId);
  if (!row) {
    return {
      flags: { expansionOk: false, deptOk: false, execOk: false, valueOk: false, habitOk: false, allComplete: false },
      error: null,
    };
  }
  if (isPhase3Terminal(row.phase3_status)) {
    if (row.phase3_status === "SKIPPED") {
      const f = readCachedMilestoneFlagsFromRow(row);
      return { flags: { ...f, allComplete: false }, error: null };
    }
    return { flags: readCachedMilestoneFlagsFromRow(row), error: null };
  }

  const eligible = await meetsPhase3EntryConditions(admin, orgId, row);
  if (!eligible) {
    return { flags: readCachedMilestoneFlagsFromRow(row), error: null };
  }

  let nextPhase3Status = row.phase3_status ?? "NOT_STARTED";
  let baselineInt = row.phase3_baseline_connected_integrations ?? 0;
  let baselineWf = row.phase3_baseline_enabled_workflows ?? 0;
  const curInt = await countConnectedIntegrations(admin, orgId);
  const curWf = await countEnabledWorkflows(admin, orgId);

  if (nextPhase3Status === "NOT_STARTED" || row.phase3_status == null) {
    nextPhase3Status = "IN_PROGRESS";
    baselineInt = curInt;
    baselineWf = curWf;
  }

  const expanded = Math.max(0, curInt - baselineInt) + Math.max(0, curWf - baselineWf);
  const deptActive = await countActiveDepartments(admin, orgId);
  const engagement = await resolveExecutiveEngagement(admin, orgId, row);
  const phase2DoneAt = row.phase2_completed_at ?? row.first_operational_event_at ?? new Date(0).toISOString();
  const storyId = row.first_value_story_id ?? (await pickFirstValueStoryId(admin, orgId, phase2DoneAt));

  const tz = await getOrgTimezone(admin, orgId);
  const { data: interactions } = await admin
    .from("org_phase3_usage_interactions")
    .select("created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  const weeks = new Set<string>();
  for (const it of interactions ?? []) {
    weeks.add(isoWeekKeyForInteraction((it as { created_at: string }).created_at, tz));
  }
  const usageCount = interactions?.length ?? 0;
  const activeWeeks = weeks.size;

  const expansionOk = expanded >= 2;
  const deptOk = deptActive >= 3;
  const execOk =
    !!(row.executive_engagement_at && row.executive_engaged_user_id) || Boolean(engagement?.userId);
  const valueOk = !!storyId;
  const habitOk = usageCount >= 5 && activeWeeks >= 2;

  const flags: Phase3MilestoneFlags = {
    expansionOk,
    deptOk,
    execOk,
    valueOk,
    habitOk,
    allComplete: expansionOk && deptOk && execOk && valueOk && habitOk,
  };

  let statusOut = nextPhase3Status;
  if (flags.allComplete) {
    statusOut = "COMPLETED";
  } else if (!valueOk && expansionOk && deptOk && execOk) {
    statusOut = "WAITING_FOR_VALUE_PROOF";
  } else if (valueOk && statusOut === "WAITING_FOR_VALUE_PROOF") {
    statusOut = "IN_PROGRESS";
  }

  const incomplete = firstIncompleteStep({ expansionOk, deptOk, execOk, valueOk, habitOk });
  const nextStep: Phase3StepKey = incomplete ?? "build_habit";

  const patch: Parameters<typeof upsertOrgOnboardingState>[1] = {
    orgId,
    phase3Status: statusOut,
    phase3CurrentStep: nextStep,
    expandedIntegrationCount: expanded,
    activeDepartmentCount: deptActive,
    phase3UsageInteractionCount: usageCount,
    phase3ActiveWeeks: activeWeeks,
    phase3BaselineConnectedIntegrations: baselineInt,
    phase3BaselineEnabledWorkflows: baselineWf,
  };

  if (!row.phase3_started_at && (row.phase3_status == null || row.phase3_status === "NOT_STARTED")) {
    patch.phase3StartedAt = new Date().toISOString();
  }

  if (storyId && !row.first_value_story_id) {
    patch.firstValueStoryId = storyId;
  }

  if (engagement && !row.executive_engagement_at) {
    patch.executiveEngagementAt = engagement.at;
    patch.executiveEngagedUserId = engagement.userId;
  }

  if (flags.allComplete && row.phase3_status !== "COMPLETED") {
    patch.phase3CompletedAt = new Date().toISOString();
  }

  const { error } = await upsertOrgOnboardingState(admin, patch);
  if (!error && flags.allComplete && row.phase3_status !== "COMPLETED") {
    await trackServerAppEvent(admin, {
      orgId,
      userId: null,
      event: "onboarding_phase3_completed",
      properties: phase3AnalyticsBase(orgId, "COMPLETED", nextStep),
    });
  }
  return { flags, error };
}

export function getOrderedPhase3Steps(): readonly Phase3StepKey[] {
  return PHASE3_STEPS;
}

/** Exported for Phase 4 entry / renewal scoring (same definition as Phase 3 “active department”). */
export async function countActiveDepartmentsForPhase3(admin: SupabaseClient, orgId: string): Promise<number> {
  return countActiveDepartments(admin, orgId);
}

export async function getOrgTimezoneForOnboarding(admin: SupabaseClient, orgId: string): Promise<string> {
  return getOrgTimezone(admin, orgId);
}
