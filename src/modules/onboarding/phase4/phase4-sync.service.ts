/**
 * Phase 4 — recompute cached milestone columns (sync-owned; UI does not write scores).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFromString, type PlanTier } from "@/services/billing/entitlements";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { auditLog } from "@/lib/audit";
import {
  getOrgOnboardingState,
  upsertOrgOnboardingState,
  type OrgOnboardingStateRow,
} from "../repositories/org-onboarding-states.repository";
import { PHASE3_QUALIFYING_INTERACTION_TYPES } from "../phase3/phase3-interaction-types";
import { isExecutiveMembership } from "../phase3/phase3-executive";
import {
  countActiveDepartmentsForPhase3,
  getOrgTimezoneForOnboarding,
} from "../phase3/phase3-sync.service";
import { phase4AnalyticsBase } from "./phase4-analytics-payload";
import { meetsPhase4EntryConditions, isPhase4Terminal } from "./phase4-entry.service";
import { PHASE4_STEPS, type Phase4StepKey } from "./phase4-constants";
import { phase4Thresholds, type Phase4ThresholdSet } from "./phase4-thresholds";

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

function isoWeekKeyForInstant(iso: string, timeZone: string): string {
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

async function getOrgPlanTier(admin: SupabaseClient, orgId: string): Promise<PlanTier> {
  const { data } = await admin.from("billing_accounts").select("plan_key").eq("org_id", orgId).maybeSingle();
  return planFromString((data as { plan_key?: string } | null)?.plan_key);
}

async function countQualifyingBusinessUnits(admin: SupabaseClient, orgId: string): Promise<number> {
  const { data: units } = await admin.from("org_business_units").select("id").eq("org_id", orgId);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const types = [...PHASE3_QUALIFYING_INTERACTION_TYPES];
  let n = 0;
  for (const u of units ?? []) {
    const unitId = String((u as { id: string }).id);
    const { data: mems } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("business_unit_id", unitId);
    const userIds = (mems ?? []).map((m) => String((m as { user_id: string }).user_id));
    if (userIds.length === 0) continue;
    const { count } = await admin
      .from("org_phase3_usage_interactions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", since)
      .in("user_id", userIds)
      .in("interaction_type", types);
    if ((count ?? 0) >= 1) n += 1;
  }
  return n;
}

async function reconcileQbrDeliveryFromGeneratedReports(admin: SupabaseClient, orgId: string) {
  const { data: wrappers } = await admin
    .from("org_qbr_reports")
    .select("id, generated_report_id, delivered_at")
    .eq("org_id", orgId)
    .not("generated_report_id", "is", null)
    .is("delivered_at", null);
  for (const w of wrappers ?? []) {
    const row = w as { id: string; generated_report_id: string };
    const { data: gr } = await admin
      .from("generated_reports")
      .select("status, storage_url, completed_at")
      .eq("id", row.generated_report_id)
      .maybeSingle();
    const g = gr as { status?: string; storage_url?: string | null; completed_at?: string | null } | null;
    if (!g?.status) continue;
    const st = String(g.status).toUpperCase();
    if (st !== "COMPLETED" && st !== "COMPLETE") continue;
    await admin
      .from("org_qbr_reports")
      .update({
        delivered_at: g.completed_at ?? new Date().toISOString(),
        storage_url: g.storage_url ?? null,
      })
      .eq("id", row.id);
  }
}

async function hasAdoptionSignal(admin: SupabaseClient, orgId: string, signalType: string): Promise<boolean> {
  const { count } = await admin
    .from("org_adoption_signals")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("signal_type", signalType);
  return (count ?? 0) >= 1;
}

async function insertAdoptionSignal(
  admin: SupabaseClient,
  orgId: string,
  signalType: string,
  signalValue: string | null,
  createdBy: string | null
) {
  await admin.from("org_adoption_signals").insert({
    org_id: orgId,
    signal_type: signalType,
    signal_value: signalValue,
    created_by: createdBy,
  });
}

async function reconcileAdoptionSignalsFromSettingsAndReports(admin: SupabaseClient, orgId: string) {
  const { data: settings } = await admin
    .from("organization_settings")
    .select("primary_dashboard, executive_reporting_primary_source")
    .eq("org_id", orgId)
    .maybeSingle();
  const s = settings as {
    primary_dashboard?: string | null;
    executive_reporting_primary_source?: boolean | null;
  } | null;

  if (String(s?.primary_dashboard ?? "").toLowerCase() === "solvren") {
    if (!(await hasAdoptionSignal(admin, orgId, "PRIMARY_DASHBOARD_SET"))) {
      await insertAdoptionSignal(admin, orgId, "PRIMARY_DASHBOARD_SET", "primary_dashboard=solvren", null);
    }
  }

  if (s?.executive_reporting_primary_source) {
    if (!(await hasAdoptionSignal(admin, orgId, "QBR_REFERENCED"))) {
      await insertAdoptionSignal(admin, orgId, "QBR_REFERENCED", "organization_settings.executive_reporting_primary_source", null);
    }
  }

  const { count: primarySourceReports } = await admin
    .from("generated_reports")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_primary_source", true);
  if ((primarySourceReports ?? 0) >= 1 && !(await hasAdoptionSignal(admin, orgId, "QBR_REFERENCED"))) {
    await insertAdoptionSignal(admin, orgId, "QBR_REFERENCED", "generated_reports.is_primary_source", null);
  }
}

async function computeSystemOfRecordConfirmed(admin: SupabaseClient, orgId: string): Promise<boolean> {
  const { count } = await admin
    .from("org_adoption_signals")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("signal_type", ["PRIMARY_DASHBOARD_SET", "QBR_REFERENCED", "CS_CONFIRMED_SYSTEM_OF_RECORD"]);
  return (count ?? 0) >= 1;
}

function normalizedConfidence(raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  if (n >= 0 && n <= 1) return n;
  return n / 100;
}

function evidenceHasGap(evidence: unknown): boolean {
  if (!evidence || typeof evidence !== "object") return false;
  const o = evidence as Record<string, unknown>;
  const a = o.gapType ?? o.gap_type;
  if (typeof a === "string" && a.trim().length > 0) return true;
  return Object.keys(o).length > 0;
}

async function countQualifyingExpansionRecommendations(admin: SupabaseClient, orgId: string): Promise<number> {
  const { data: rows } = await admin
    .from("activation_recommendations")
    .select("recommendation_status, confidence_score, evidence_json, recommendation_type, target_key")
    .eq("org_id", orgId);
  let n = 0;
  for (const r of rows ?? []) {
    const st = String((r as { recommendation_status?: string }).recommendation_status ?? "").toUpperCase();
    if (st === "DISMISSED") continue;
    if (normalizedConfidence((r as { confidence_score?: unknown }).confidence_score) < 0.7) continue;
    const targetKey = String((r as { target_key?: string }).target_key ?? "").trim();
    const gap =
      evidenceHasGap((r as { evidence_json?: unknown }).evidence_json) ||
      targetKey.length > 0 ||
      String((r as { recommendation_type?: string }).recommendation_type ?? "").trim().length > 0;
    if (!gap) continue;
    n += 1;
  }
  return n;
}

async function countActiveValueStories(admin: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await admin
    .from("value_stories")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "ACTIVE");
  return count ?? 0;
}

async function countDistinctUsageWeeksInWindow(
  admin: SupabaseClient,
  orgId: string,
  timeZone: string,
  windowWeeks: number
): Promise<number> {
  const sinceMs = Date.now() - windowWeeks * 7 * 86400000;
  const since = new Date(sinceMs).toISOString();
  const { data: interactions } = await admin
    .from("org_phase3_usage_interactions")
    .select("created_at")
    .eq("org_id", orgId)
    .gte("created_at", since);
  const weeks = new Set<string>();
  for (const it of interactions ?? []) {
    weeks.add(isoWeekKeyForInstant((it as { created_at: string }).created_at, timeZone));
  }
  return weeks.size;
}

function orderedIsoWeekKeysBackward(timeZone: string, maxDays: number): string[] {
  const out: string[] = [];
  let last = "";
  for (let i = 0; i < maxDays; i += 1) {
    const t = new Date(Date.now() - i * 86400000);
    const wk = isoWeekKeyForInstant(t.toISOString(), timeZone);
    if (wk !== last) {
      out.push(wk);
      last = wk;
    }
  }
  return out;
}

async function computeExecutiveCadenceStreak(
  admin: SupabaseClient,
  orgId: string,
  timeZone: string
): Promise<number> {
  const { data: reports } = await admin
    .from("org_qbr_reports")
    .select("id, delivered_at")
    .eq("org_id", orgId)
    .eq("report_type", "WEEKLY_EXECUTIVE_SUMMARY")
    .not("delivered_at", "is", null);

  if (!reports?.length) return 0;

  const reportIds = reports.map((r) => String((r as { id: string }).id));
  const { data: mems } = await admin
    .from("organization_members")
    .select("user_id, role, department, title")
    .eq("org_id", orgId);
  const execUserIds = new Set<string>();
  for (const m of mems ?? []) {
    const u = m as { user_id: string; role?: string; department?: string; title?: string };
    if (isExecutiveMembership({ role: u.role, department: u.department, title: u.title })) {
      execUserIds.add(String(u.user_id));
    }
  }

  const { data: audits } = await admin
    .from("audit_log")
    .select("entity_type, entity_id, actor_id, created_at, action")
    .eq("org_id", orgId)
    .in("action", ["qbr_report_opened", "executive_summary_opened"])
    .in("entity_id", reportIds);

  const qualifyingWeeks = new Set<string>();
  for (const rep of reports) {
    const r = rep as { id: string; delivered_at: string };
    const deliveredWeek = isoWeekKeyForInstant(r.delivered_at, timeZone);
    for (const a of audits ?? []) {
      const row = a as {
        entity_type: string;
        entity_id: string | null;
        actor_id: string | null;
        created_at: string;
      };
      if (!row.entity_id || !row.actor_id) continue;
      if (String(row.entity_id) !== r.id) continue;
      const et = String(row.entity_type).toLowerCase();
      if (et !== "qbr_report" && et !== "executive_summary") continue;
      if (!execUserIds.has(String(row.actor_id))) continue;
      const openWeek = isoWeekKeyForInstant(row.created_at, timeZone);
      if (openWeek === deliveredWeek) qualifyingWeeks.add(deliveredWeek);
    }
  }

  let streak = 0;
  for (const wk of orderedIsoWeekKeysBackward(timeZone, 400)) {
    if (qualifyingWeeks.has(wk)) streak += 1;
    else break;
  }
  return streak;
}

function renewalScoreFromFactors(args: {
  t: Phase4ThresholdSet;
  activeDepartments: number;
  valueStories: number;
  execStreak: number;
  weeklyUsageWeeks: number;
  connectedIntegrations: number;
  enabledWorkflows: number;
}): number {
  const { t, activeDepartments, valueStories, execStreak, weeklyUsageWeeks, connectedIntegrations, enabledWorkflows } =
    args;
  const deptScore = Math.min(20, (activeDepartments / t.renewalDeptTarget) * 20);
  const storyScore = Math.min(20, (valueStories / t.renewalValueStoryTarget) * 20);
  const execScore = Math.min(20, (execStreak / t.renewalExecutiveStreakTarget) * 20);
  const usageScore = Math.min(20, (weeklyUsageWeeks / t.renewalWeeklyUsageWeeksTarget) * 20);
  const intPart = Math.min(1, connectedIntegrations / t.connectedIntegrations) * 20;
  const wfPart = Math.min(1, enabledWorkflows / t.enabledWorkflows) * 20;
  const depthScore = (intPart + wfPart) / 2;
  return Math.round(deptScore + storyScore + execScore + usageScore + depthScore);
}

function firstIncompleteStep(flags: {
  expansionOk: boolean;
  depthOk: boolean;
  execOk: boolean;
  sorOk: boolean;
  renewalOk: boolean;
}): Phase4StepKey {
  if (!flags.expansionOk) return "expand_org_footprint";
  if (!flags.depthOk) return "increase_depth";
  if (!flags.execOk) return "executive_qbrs";
  if (!flags.sorOk) return "become_system_of_record";
  if (!flags.renewalOk) return "prepare_for_renewal";
  return "prepare_for_renewal";
}

export type Phase4MilestoneFlags = {
  expansionOk: boolean;
  depthOk: boolean;
  execOk: boolean;
  sorOk: boolean;
  renewalOk: boolean;
  allComplete: boolean;
};

export function computePhase4MilestoneFlags(
  row: OrgOnboardingStateRow | null,
  plan: PlanTier
): Phase4MilestoneFlags {
  if (!row) {
    return {
      expansionOk: false,
      depthOk: false,
      execOk: false,
      sorOk: false,
      renewalOk: false,
      allComplete: false,
    };
  }
  const t = phase4Thresholds(plan);
  const expansionOk = (row.phase4_expanded_unit_count ?? 0) >= t.businessUnitDelta;
  const depthOk =
    (row.phase4_connected_integrations ?? 0) >= t.connectedIntegrations &&
    (row.phase4_enabled_workflows ?? 0) >= t.enabledWorkflows;
  const execOk = (row.phase4_consecutive_executive_weeks ?? 0) >= t.consecutiveExecutiveWeeks;
  const sorOk = !!row.phase4_system_of_record_confirmed;
  const renewalOk =
    (row.phase4_renewal_score ?? 0) >= 80 && (row.phase4_expansion_recommendation_count ?? 0) >= 1;
  const allComplete = expansionOk && depthOk && execOk && sorOk && renewalOk;
  return { expansionOk, depthOk, execOk, sorOk, renewalOk, allComplete };
}

export async function runPhase4Sync(orgId: string): Promise<{ flags: Phase4MilestoneFlags; error: Error | null }> {
  const admin = createAdminClient();
  const { data: row } = await getOrgOnboardingState(admin, orgId);
  const plan = await getOrgPlanTier(admin, orgId);
  const t = phase4Thresholds(plan);

  if (!row) {
    return {
      flags: {
        expansionOk: false,
        depthOk: false,
        execOk: false,
        sorOk: false,
        renewalOk: false,
        allComplete: false,
      },
      error: null,
    };
  }

  if (isPhase4Terminal(row.phase4_status)) {
    if (row.phase4_status === "SKIPPED") {
      return { flags: { ...computePhase4MilestoneFlags(row, plan), allComplete: false }, error: null };
    }
    return { flags: computePhase4MilestoneFlags(row, plan), error: null };
  }

  const eligible = await meetsPhase4EntryConditions(admin, orgId, row);
  if (!eligible) {
    return { flags: computePhase4MilestoneFlags(row, plan), error: null };
  }

  await reconcileQbrDeliveryFromGeneratedReports(admin, orgId);
  await reconcileAdoptionSignalsFromSettingsAndReports(admin, orgId);

  const tz = await getOrgTimezoneForOnboarding(admin, orgId);
  const qualifyingBu = await countQualifyingBusinessUnits(admin, orgId);
  const baseline = row.phase4_baseline_business_unit_count ?? 0;
  let nextBaseline = baseline;
  let nextStatus = row.phase4_status ?? "NOT_STARTED";

  if (nextStatus === "NOT_STARTED" || row.phase4_status == null) {
    nextStatus = "IN_PROGRESS";
    nextBaseline = qualifyingBu;
  }

  const expandedCount = Math.max(0, qualifyingBu - nextBaseline);
  const connected = await countConnectedIntegrations(admin, orgId);
  const workflows = await countEnabledWorkflows(admin, orgId);
  const execStreak = await computeExecutiveCadenceStreak(admin, orgId, tz);
  const sor = await computeSystemOfRecordConfirmed(admin, orgId);
  const expansionRecs = await countQualifyingExpansionRecommendations(admin, orgId);
  const activeDepts = await countActiveDepartmentsForPhase3(admin, orgId);
  const stories = await countActiveValueStories(admin, orgId);
  const weeklyUsageWeeks = await countDistinctUsageWeeksInWindow(admin, orgId, tz, t.renewalWeeklyUsageWindowWeeks);
  const renewalScore = renewalScoreFromFactors({
    t,
    activeDepartments: activeDepts,
    valueStories: stories,
    execStreak,
    weeklyUsageWeeks,
    connectedIntegrations: connected,
    enabledWorkflows: workflows,
  });

  const expansionOk = expandedCount >= t.businessUnitDelta;
  const depthOk = connected >= t.connectedIntegrations && workflows >= t.enabledWorkflows;
  const execOk = execStreak >= t.consecutiveExecutiveWeeks;
  const sorOk = sor;
  const renewalOk = renewalScore >= 80 && expansionRecs >= 1;
  const allComplete = expansionOk && depthOk && execOk && sorOk && renewalOk;

  let statusOut: string = nextStatus;
  if (allComplete) {
    statusOut = "COMPLETED";
  } else if (depthOk && execOk && sorOk && renewalOk && !expansionOk) {
    statusOut = "WAITING_FOR_EXPANSION";
  } else if (expansionOk && depthOk && execOk && sorOk && renewalScore < 80) {
    statusOut = "WAITING_FOR_RENEWAL_READINESS";
  } else {
    statusOut = "IN_PROGRESS";
  }

  const incomplete = firstIncompleteStep({ expansionOk, depthOk, execOk, sorOk, renewalOk });
  const nextStep: Phase4StepKey = allComplete ? PHASE4_STEPS[PHASE4_STEPS.length - 1] : incomplete;

  const patch: Parameters<typeof upsertOrgOnboardingState>[1] = {
    orgId,
    phase4Status: statusOut,
    phase4CurrentStep: nextStep,
    phase4ExpandedUnitCount: expandedCount,
    phase4ConnectedIntegrations: connected,
    phase4EnabledWorkflows: workflows,
    phase4ConsecutiveExecutiveWeeks: execStreak,
    phase4SystemOfRecordConfirmed: sorOk,
    phase4RenewalScore: renewalScore,
    phase4ExpansionRecommendationCount: expansionRecs,
    phase4BaselineBusinessUnitCount: nextBaseline,
  };

  if (!row.phase4_started_at && (row.phase4_status == null || row.phase4_status === "NOT_STARTED")) {
    patch.phase4StartedAt = new Date().toISOString();
  }

  if (allComplete && row.phase4_status !== "COMPLETED") {
    patch.phase4CompletedAt = new Date().toISOString();
  }

  const prevScore = row.phase4_renewal_score ?? 0;
  const prevConnected = row.phase4_connected_integrations ?? 0;
  const prevWorkflows = row.phase4_enabled_workflows ?? 0;
  const { error } = await upsertOrgOnboardingState(admin, patch);
  if (!error && (connected > prevConnected || workflows > prevWorkflows)) {
    await auditLog(admin, {
      orgId,
      actorId: null,
      actorType: "SYSTEM",
      action: "onboarding_phase4_integration_depth_increased",
      entityType: "org_onboarding_states",
      entityId: orgId,
      metadata: {
        connectedIntegrations: connected,
        enabledWorkflows: workflows,
        prevConnected,
        prevWorkflows,
      },
    });
    await trackServerAppEvent(admin, {
      orgId,
      userId: null,
      event: "onboarding_phase4_integration_depth_increased",
      properties: {
        ...phase4AnalyticsBase(orgId, statusOut, nextStep),
        connectedIntegrations: connected,
        enabledWorkflows: workflows,
      },
    });
  }
  if (!error && renewalScore !== prevScore) {
    await trackServerAppEvent(admin, {
      orgId,
      userId: null,
      event: "onboarding_phase4_renewal_score_updated",
      properties: { ...phase4AnalyticsBase(orgId, statusOut, nextStep), renewalScore },
    });
  }
  if (!error && allComplete && row.phase4_status !== "COMPLETED") {
    await trackServerAppEvent(admin, {
      orgId,
      userId: null,
      event: "onboarding_phase4_completed",
      properties: phase4AnalyticsBase(orgId, "COMPLETED", nextStep),
    });
  }

  const flags: Phase4MilestoneFlags = {
    expansionOk,
    depthOk,
    execOk,
    sorOk,
    renewalOk,
    allComplete,
  };
  return { flags, error };
}
