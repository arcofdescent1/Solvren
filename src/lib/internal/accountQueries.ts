import type { SupabaseClient } from "@supabase/supabase-js";
import { planFromString, type PlanTier } from "@/services/billing/entitlements";
import { computeLastActivityAt } from "./lastActivity";
import {
  onboardingPhaseSummaryFromState,
  type OnboardingPhaseSummary,
} from "./onboardingPhaseSummary";

export type InternalAccountListItem = {
  orgId: string;
  name: string;
  slug: string | null;
  plan: PlanTier;
  billingStatus: string | null;
  onboardingPhaseSummary: OnboardingPhaseSummary;
  memberCount: number;
  pendingInviteCount: number;
  integrationCount: number;
  lastActivityAt: string;
  billingEmailPreview: string | null;
};

type OrgRow = { id: string; name: string; slug: string | null; created_at: string };

const FILTER_SCAN_CAP = 2500;

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

function matchesSearch(
  org: OrgRow,
  billingEmail: string | null,
  q: string
): boolean {
  const needle = norm(q);
  if (!needle) return true;
  if (norm(org.name).includes(needle)) return true;
  if (org.slug && norm(org.slug).includes(needle)) return true;
  if (billingEmail && norm(billingEmail).includes(needle)) return true;
  return false;
}

async function countByOrg(
  admin: SupabaseClient,
  table: "organization_members" | "org_invites" | "integration_connections",
  orgIds: string[],
  invitePendingOnly?: boolean
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of orgIds) map.set(id, 0);
  if (orgIds.length === 0) return map;

  let q = admin.from(table).select("org_id").in("org_id", orgIds);
  if (table === "org_invites" && invitePendingOnly) {
    q = q.eq("status", "PENDING");
  }
  const { data, error } = await q;
  if (error || !data) return map;
  for (const row of data as { org_id: string }[]) {
    const id = row.org_id;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

async function hydrateOrgs(
  admin: SupabaseClient,
  orgs: OrgRow[],
  includeLastActivity: boolean
): Promise<InternalAccountListItem[]> {
  const ids = orgs.map((o) => o.id);
  if (ids.length === 0) return [];

  const [billingRes, obRes, settingsRes, memberMap, pendingMap, intMap] = await Promise.all([
    admin.from("billing_accounts").select("org_id, plan_key, status").in("org_id", ids),
    admin
      .from("org_onboarding_states")
      .select("org_id, guided_phase1_status, phase2_status, phase3_status, phase4_status")
      .in("org_id", ids),
    admin.from("organization_settings").select("org_id, notification_emails").in("org_id", ids),
    countByOrg(admin, "organization_members", ids),
    countByOrg(admin, "org_invites", ids, true),
    countByOrg(admin, "integration_connections", ids),
  ]);

  const billingByOrg = new Map<string, { plan_key: string; status: string }>();
  for (const b of (billingRes.data ?? []) as { org_id: string; plan_key: string; status: string }[]) {
    billingByOrg.set(b.org_id, { plan_key: b.plan_key, status: b.status });
  }

  const obByOrg = new Map<string, Record<string, unknown>>();
  for (const r of (obRes.data ?? []) as Record<string, unknown>[]) {
    obByOrg.set(String(r.org_id), r);
  }

  const emailByOrg = new Map<string, string | null>();
  for (const s of (settingsRes.data ?? []) as {
    org_id: string;
    notification_emails: string[] | null;
  }[]) {
    const first = s.notification_emails?.[0] ?? null;
    emailByOrg.set(s.org_id, first);
  }

  const items: InternalAccountListItem[] = [];
  for (const org of orgs) {
    const billing = billingByOrg.get(org.id);
    const plan = billing ? planFromString(billing.plan_key) : ("FREE" as PlanTier);
    const billingStatus = billing?.status ?? null;
    const ob = obByOrg.get(org.id);
    const onboardingPhaseSummary = onboardingPhaseSummaryFromState(
      ob as Parameters<typeof onboardingPhaseSummaryFromState>[0]
    );
    const billingEmailPreview = emailByOrg.get(org.id) ?? null;

    items.push({
      orgId: org.id,
      name: org.name,
      slug: org.slug ?? null,
      plan,
      billingStatus,
      onboardingPhaseSummary,
      memberCount: memberMap.get(org.id) ?? 0,
      pendingInviteCount: pendingMap.get(org.id) ?? 0,
      integrationCount: intMap.get(org.id) ?? 0,
      lastActivityAt: org.created_at,
      billingEmailPreview,
    });
  }

  if (includeLastActivity) {
    await Promise.all(
      items.map(async (it, i) => {
        const created = orgs[i]!.created_at;
        it.lastActivityAt = await computeLastActivityAt(admin, it.orgId, created);
      })
    );
  }

  return items;
}

function applyFilters(
  items: InternalAccountListItem[],
  filters: {
    plan?: PlanTier;
    billingStatus?: string | null;
    onboardingPhaseSummary?: OnboardingPhaseSummary | null;
    hasIntegration?: boolean | null;
    q?: string | null;
  },
  orgById: Map<string, OrgRow>
): InternalAccountListItem[] {
  return items.filter((it) => {
    if (filters.plan !== undefined && it.plan !== filters.plan) return false;
    if (filters.billingStatus) {
      const want = norm(filters.billingStatus);
      const got = norm(it.billingStatus ?? "");
      if (got !== want) return false;
    }
    if (filters.onboardingPhaseSummary && it.onboardingPhaseSummary !== filters.onboardingPhaseSummary) {
      return false;
    }
    if (filters.hasIntegration === true && it.integrationCount <= 0) return false;
    if (filters.hasIntegration === false && it.integrationCount > 0) return false;
    if (filters.q) {
      const org = orgById.get(it.orgId);
      if (!org) return false;
      if (!matchesSearch(org, it.billingEmailPreview, filters.q)) return false;
    }
    return true;
  });
}

export async function listInternalAccounts(params: {
  admin: SupabaseClient;
  page: number;
  pageSize: number;
  q?: string | null;
  plan?: PlanTier;
  billingStatus?: string | null;
  onboardingPhaseSummary?: OnboardingPhaseSummary | null;
  hasIntegration?: boolean | null;
}): Promise<{ items: InternalAccountListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const hasFilters = Boolean(
    params.q ||
      params.plan ||
      params.billingStatus ||
      params.onboardingPhaseSummary ||
      params.hasIntegration !== null && params.hasIntegration !== undefined
  );

  if (!hasFilters) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: orgs, count, error } = await params.admin
      .from("organizations")
      .select("id, name, slug, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    const orgRows = (orgs ?? []) as OrgRow[];
    const hydrated = await hydrateOrgs(params.admin, orgRows, true);
    return { items: hydrated, total: count ?? hydrated.length, page, pageSize };
  }

  const { data: scanOrgs, error: scanErr } = await params.admin
    .from("organizations")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false })
    .limit(FILTER_SCAN_CAP);

  if (scanErr) throw new Error(scanErr.message);
  const orgRows = (scanOrgs ?? []) as OrgRow[];
  const orgById = new Map(orgRows.map((o) => [o.id, o]));
  const hydrated = await hydrateOrgs(params.admin, orgRows, true);
  const filtered = applyFilters(hydrated, params, orgById);
  const total = filtered.length;
  const slice = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  return { items: slice, total, page, pageSize };
}

export async function assertOrganizationExists(
  admin: SupabaseClient,
  orgId: string
): Promise<OrgRow | null> {
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, slug, created_at")
    .eq("id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as OrgRow | null) ?? null;
}
