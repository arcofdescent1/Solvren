import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgTimezone } from "@/lib/org/getOrgTimezone";

export type ExecutivePhase5Payload = {
  issuesRevenueAtRiskCents: number;
  roiByType: Record<string, number>;
  needsAttention: {
    approvalPending: number;
    slaBreached: number;
    unassignedHighImpact: number;
  };
  trends: {
    day: string;
    issuesOpened: number;
    issuesResolved: number;
    revenueAtRiskCents: number;
    roiCents: number;
  }[];
  timezone: string;
};

function localDayInTz(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

async function fetchPhase5ExecutiveData(admin: SupabaseClient, orgId: string): Promise<ExecutivePhase5Payload> {
  const tz = await getOrgTimezone(admin, orgId);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const nowIso = new Date().toISOString();

  const { data: riskRows } = await admin
    .from("issues")
    .select("revenue_impact_cents")
    .eq("org_id", orgId)
    .is("suppressed_until", null)
    .not("status", "in", '("resolved","verified","dismissed")');

  let issuesRevenueAtRiskCents = 0;
  for (const row of riskRows ?? []) {
    issuesRevenueAtRiskCents += Number((row as { revenue_impact_cents?: number }).revenue_impact_cents ?? 0);
  }

  const { data: roiAgg } = await admin
    .from("roi_events")
    .select("roi_type, actual_value_cents")
    .eq("org_id", orgId)
    .not("actual_value_cents", "is", null);

  const roiByType: Record<string, number> = {};
  for (const row of roiAgg ?? []) {
    const t = String((row as { roi_type: string }).roi_type);
    const v = Number((row as { actual_value_cents: number }).actual_value_cents ?? 0);
    roiByType[t] = (roiByType[t] ?? 0) + v;
  }

  const [{ count: ap }, { count: slaB }, { count: uhi }] = await Promise.all([
    admin
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("approval_state", "pending")
      .not("status", "in", '("resolved","verified","dismissed")'),
    admin
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("sla_due_at", "is", null)
      .lt("sla_due_at", nowIso)
      .not("status", "in", '("resolved","verified","dismissed")'),
    admin
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("owner_user_id", null)
      .is("owner_email", null)
      .is("owner_team_key", null)
      .not("status", "in", '("resolved","verified","dismissed")')
      .or("severity.eq.high,revenue_impact_cents.gte.500000"),
  ]);

  const { data: issues30 } = await admin
    .from("issues")
    .select("opened_at, resolved_at")
    .eq("org_id", orgId)
    .gte("opened_at", sinceIso);

  const { data: roi30 } = await admin
    .from("roi_events")
    .select("created_at, actual_value_cents")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso)
    .not("actual_value_cents", "is", null);

  const dayKeys: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (29 - i));
    dayKeys.push(localDayInTz(d.toISOString(), tz));
  }
  const trendMap = new Map<
    string,
    { issuesOpened: number; issuesResolved: number; revenueAtRiskCents: number; roiCents: number }
  >();
  for (const k of dayKeys) {
    trendMap.set(k, { issuesOpened: 0, issuesResolved: 0, revenueAtRiskCents: 0, roiCents: 0 });
  }

  for (const row of issues30 ?? []) {
    const opened = (row as { opened_at: string }).opened_at;
    const resolvedAt = (row as { resolved_at: string | null }).resolved_at;
    const kOpen = localDayInTz(opened, tz);
    const t = trendMap.get(kOpen);
    if (t) t.issuesOpened += 1;
    if (resolvedAt) {
      const kr = localDayInTz(resolvedAt, tz);
      const tr = trendMap.get(kr);
      if (tr) tr.issuesResolved += 1;
    }
  }

  for (const row of roi30 ?? []) {
    const k = localDayInTz((row as { created_at: string }).created_at, tz);
    const t = trendMap.get(k);
    if (t) t.roiCents += Number((row as { actual_value_cents: number }).actual_value_cents ?? 0);
  }

  const trends = dayKeys.map((day) => {
    const t = trendMap.get(day)!;
    return {
      day,
      issuesOpened: t.issuesOpened,
      issuesResolved: t.issuesResolved,
      revenueAtRiskCents: t.revenueAtRiskCents,
      roiCents: t.roiCents,
    };
  });

  return {
    issuesRevenueAtRiskCents,
    roiByType,
    needsAttention: {
      approvalPending: ap ?? 0,
      slaBreached: slaB ?? 0,
      unassignedHighImpact: uhi ?? 0,
    },
    trends,
    timezone: tz,
  };
}

export async function getCachedExecutivePhase5(orgId: string): Promise<ExecutivePhase5Payload> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient();
      return fetchPhase5ExecutiveData(admin, orgId);
    },
    ["executive-phase5", orgId],
    { revalidate: 60, tags: [orgId] }
  )();
}

export function revalidateExecutiveCache(orgId: string): void {
  try {
    revalidateTag(orgId, "default");
  } catch {
    /* ignore */
  }
}
