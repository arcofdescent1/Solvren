import type { SupabaseClient } from "@supabase/supabase-js";
import { trimmedMedianHours } from "@/lib/outcomes/approvalBaseline";

export type ApprovalTimeSavedComputation =
  | {
      ok: true;
      baselineHours: number;
      actualHours: number;
      hoursSaved: number;
      baselineSampleSize: number;
      baselineScope: string;
    }
  | { ok: false; reason: "INSUFFICIENT_BASELINE_SAMPLE" | "INCOMPLETE_APPROVALS" | "NOT_FAST_ENOUGH" };

type ApprovalRow = {
  approval_area: string;
  approver_user_id: string | null;
  decision: string | null;
  created_at: string;
  decided_at: string | null;
};

function hoursBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return (b - a) / 3600000;
}

async function dominantApprovalArea(admin: SupabaseClient, changeId: string): Promise<string | null> {
  const { data: rows } = await admin
    .from("approvals")
    .select("approval_area")
    .eq("change_event_id", changeId);
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const a = String((r as { approval_area?: string }).approval_area ?? "General");
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      n = v;
      best = k;
    }
  }
  return best;
}

async function approverOrgRole(
  admin: SupabaseClient,
  orgId: string,
  approverUserId: string | null
): Promise<string | null> {
  if (!approverUserId) return null;
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", approverUserId)
    .maybeSingle();
  return (data as { role?: string } | null)?.role ?? null;
}

async function actualApprovalHoursForChange(
  admin: SupabaseClient,
  changeId: string
): Promise<{ hours: number; firstAt: string; lastAt: string } | null> {
  const { data: rows } = await admin
    .from("approvals")
    .select("approval_area, approver_user_id, decision, created_at, decided_at")
    .eq("change_event_id", changeId);

  const approved = (rows ?? []).filter(
    (r) => String((r as ApprovalRow).decision ?? "").toUpperCase() === "APPROVED"
  ) as ApprovalRow[];

  if (approved.length === 0) return null;

  let minCreated = approved[0]!.created_at;
  let maxDecided = approved[0]!.decided_at ?? approved[0]!.created_at;

  for (const a of approved) {
    if (!a.created_at || !a.decided_at) return null;
    if (new Date(a.created_at) < new Date(minCreated)) minCreated = a.created_at;
    if (new Date(a.decided_at) > new Date(maxDecided)) maxDecided = a.decided_at;
  }

  return {
    hours: hoursBetween(minCreated, maxDecided),
    firstAt: minCreated,
    lastAt: maxDecided,
  };
}

type CohortRow = { changeId: string; domain: string; hours: number; area: string | null; role: string | null };

async function loadCohort(
  admin: SupabaseClient,
  orgId: string,
  excludeChangeId: string,
  sinceIso: string
): Promise<CohortRow[]> {
  const { data: changes } = await admin
    .from("change_events")
    .select("id, domain, status")
    .eq("org_id", orgId)
    .eq("status", "APPROVED")
    .neq("id", excludeChangeId)
    .gte("updated_at", sinceIso)
    .limit(400);

  const out: CohortRow[] = [];
  for (const c of changes ?? []) {
    const id = (c as { id: string }).id;
    const domain = String((c as { domain?: string }).domain ?? "");
    const act = await actualApprovalHoursForChange(admin, id);
    if (!act || act.hours <= 0) continue;
    const area = await dominantApprovalArea(admin, id);
    const { data: firstAppr } = await admin
      .from("approvals")
      .select("approver_user_id, created_at")
      .eq("change_event_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const uid = (firstAppr as { approver_user_id?: string | null } | null)?.approver_user_id ?? null;
    const role = await approverOrgRole(admin, orgId, uid);
    out.push({ changeId: id, domain, hours: act.hours, area, role });
  }
  return out;
}

function baselineFromDurations(durations: number[]): { hours: number; n: number } | null {
  const med = trimmedMedianHours(durations, 0.05);
  if (med == null) return null;
  return { hours: med, n: durations.length };
}

/**
 * Rolling 90-day trimmed median baseline with org / domain / area / role fallbacks.
 */
export async function computeApprovalTimeSaved(
  admin: SupabaseClient,
  args: { orgId: string; changeEventId: string }
): Promise<ApprovalTimeSavedComputation> {
  const { orgId, changeEventId } = args;
  const since = new Date(Date.now() - 90 * 86400000).toISOString();

  const { data: change } = await admin
    .from("change_events")
    .select("id, domain, status, org_id")
    .eq("id", changeEventId)
    .maybeSingle();
  const ch = change as { id: string; domain?: string; status?: string; org_id: string } | null;
  if (!ch || String(ch.status ?? "").toUpperCase() !== "APPROVED") {
    return { ok: false, reason: "INCOMPLETE_APPROVALS" };
  }

  const actual = await actualApprovalHoursForChange(admin, changeEventId);
  if (!actual) return { ok: false, reason: "INCOMPLETE_APPROVALS" };

  const area = await dominantApprovalArea(admin, changeEventId);
  const { data: firstAppr } = await admin
    .from("approvals")
    .select("approver_user_id, created_at")
    .eq("change_event_id", changeEventId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const firstUid = (firstAppr as { approver_user_id?: string | null } | null)?.approver_user_id ?? null;
  const approverRole = await approverOrgRole(admin, orgId, firstUid);
  const domain = String(ch.domain ?? "");

  const cohort = await loadCohort(admin, orgId, changeEventId, since);

  const tryScope = (
    label: string,
    pred: (r: CohortRow) => boolean
  ): { hours: number; n: number; scope: string } | null => {
    const durs = cohort.filter(pred).map((r) => r.hours);
    const b = baselineFromDurations(durs);
    if (!b || b.n < 5) return null;
    return { hours: b.hours, n: b.n, scope: label };
  };

  const scoped =
    tryScope("ORG+DOMAIN+AREA+ROLE", (r) => r.domain === domain && r.area === area && r.role === approverRole) ??
    tryScope("ORG+DOMAIN+AREA", (r) => r.domain === domain && r.area === area) ??
    tryScope("ORG+DOMAIN", (r) => r.domain === domain) ??
    tryScope("ORG", () => true);

  if (!scoped) {
    return { ok: false, reason: "INSUFFICIENT_BASELINE_SAMPLE" };
  }

  const hoursSaved = scoped.hours - actual.hours;
  if (hoursSaved < 24) {
    return { ok: false, reason: "NOT_FAST_ENOUGH" };
  }

  return {
    ok: true,
    baselineHours: scoped.hours,
    actualHours: actual.hours,
    hoursSaved,
    baselineSampleSize: scoped.n,
    baselineScope: scoped.scope,
  };
}

export async function getFinalApprovalCompletedAt(
  admin: SupabaseClient,
  changeEventId: string
): Promise<string | null> {
  const act = await actualApprovalHoursForChange(admin, changeEventId);
  return act?.lastAt ?? null;
}
