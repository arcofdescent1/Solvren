/**
 * Phase 4 — entry gate (Phase 3 complete + maturity signal).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { planFromString } from "@/services/billing/entitlements";
import type { OrgOnboardingStateRow } from "../repositories/org-onboarding-states.repository";
import { countActiveDepartmentsForPhase3, getOrgTimezoneForOnboarding } from "../phase3/phase3-sync.service";
import { PHASE4_TERMINAL } from "./phase4-constants";
import { phase4Thresholds } from "./phase4-thresholds";

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

function calendarDaysBetweenInOrgTz(startIso: string, endIso: string, timeZone: string): number {
  const a = calendarDateInTimeZone(startIso, timeZone);
  const b = calendarDateInTimeZone(endIso, timeZone);
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

async function countActiveValueStoriesSincePhase3(
  admin: SupabaseClient,
  orgId: string,
  phase3CompletedAt: string
): Promise<number> {
  const { count } = await admin
    .from("value_stories")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .gte("created_at", phase3CompletedAt);
  return count ?? 0;
}

async function getOrgPlanTier(admin: SupabaseClient, orgId: string) {
  const { data } = await admin.from("billing_accounts").select("plan_key").eq("org_id", orgId).maybeSingle();
  return planFromString((data as { plan_key?: string } | null)?.plan_key);
}

export async function meetsPhase4EntryConditions(
  admin: SupabaseClient,
  orgId: string,
  row: OrgOnboardingStateRow | null
): Promise<boolean> {
  if (!row) return false;
  if (row.phase3_status !== "COMPLETED") return false;
  const phase3CompletedAt = row.phase3_completed_at;
  if (!phase3CompletedAt) return false;

  const plan = await getOrgPlanTier(admin, orgId);
  const t = phase4Thresholds(plan);
  const tz = await getOrgTimezoneForOnboarding(admin, orgId);

  const storiesOk = (await countActiveValueStoriesSincePhase3(admin, orgId, phase3CompletedAt)) >= 3;
  const daysOk = calendarDaysBetweenInOrgTz(phase3CompletedAt, new Date().toISOString(), tz) >= 30;
  const deptOk = (await countActiveDepartmentsForPhase3(admin, orgId)) >= t.entryActiveDepartments;

  return storiesOk || daysOk || deptOk;
}

export function isPhase4Terminal(status: string | null | undefined): boolean {
  return status != null && PHASE4_TERMINAL.has(status);
}
