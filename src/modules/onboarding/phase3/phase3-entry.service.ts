/**
 * Phase 3 — entry gate (Phase 2 complete, operational anchor, activity or time gate).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgOnboardingStateRow } from "../repositories/org-onboarding-states.repository";
import { PHASE3_TERMINAL } from "./phase3-constants";

function addDays(iso: string, days: number): number {
  return new Date(iso).getTime() + days * 86400000;
}

export async function countDistinctOperationalEventsSince(
  admin: SupabaseClient,
  orgId: string,
  sinceIso: string
): Promise<number> {
  const since = sinceIso;

  const { data: issues } = await admin
    .from("issues")
    .select("id")
    .eq("org_id", orgId)
    .gte("opened_at", since);
  const issueIds = new Set((issues ?? []).map((r) => (r as { id: string }).id));

  const { data: appr } = await admin
    .from("approvals")
    .select("id, change_event_id")
    .eq("org_id", orgId)
    .gte("created_at", since);
  const apprIds = new Set((appr ?? []).map((r) => (r as { id: string }).id));

  const { data: runs } = await admin
    .from("detector_runs")
    .select("id")
    .eq("org_id", orgId)
    .gte("started_at", since)
    .gt("detection_count", 0);
  const runIds = new Set((runs ?? []).map((r) => (r as { id: string }).id));

  const { data: nx } = await admin
    .from("notification_outbox")
    .select("id")
    .eq("org_id", orgId)
    .gte("created_at", since)
    .or("delivered_at.not.is.null,sent_at.not.is.null");
  const nxIds = new Set((nx ?? []).map((r) => (r as { id: string }).id));

  return issueIds.size + apprIds.size + runIds.size + nxIds.size;
}

export async function hasActivePolicy(admin: SupabaseClient, orgId: string): Promise<boolean> {
  const { count } = await admin
    .from("policies")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");
  return (count ?? 0) >= 1;
}

export async function hasEnabledWorkflow(admin: SupabaseClient, orgId: string): Promise<boolean> {
  const { count } = await admin
    .from("detector_configs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("enabled", true);
  return (count ?? 0) >= 1;
}

export async function meetsPhase3EntryConditions(
  admin: SupabaseClient,
  orgId: string,
  row: OrgOnboardingStateRow | null
): Promise<boolean> {
  if (!row) return false;
  if (row.phase2_status !== "COMPLETED") return false;
  if (!row.first_operational_event_at) return false;
  const policyOk = await hasActivePolicy(admin, orgId);
  const wfOk = await hasEnabledWorkflow(admin, orgId);
  if (!policyOk && !wfOk) return false;

  const completedAt = row.phase2_completed_at;
  if (!completedAt) return false;
  if (addDays(completedAt, 7) <= Date.now()) return true;

  const n = await countDistinctOperationalEventsSince(admin, orgId, completedAt);
  return n >= 3;
}

export function isPhase3Terminal(status: string | null | undefined): boolean {
  return status != null && PHASE3_TERMINAL.has(status);
}
