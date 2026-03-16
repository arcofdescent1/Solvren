import type { SupabaseClient } from "@supabase/supabase-js";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole, type OrgRole } from "@/lib/rbac/roles";

export type ChangeVisibilityRow = {
  id: string;
  org_id: string;
  domain: string | null;
  status: string | null;
  created_by: string | null;
  is_restricted?: boolean | null;
};

type AccessContext = {
  roleByOrgId: Map<string, OrgRole>;
  domainViewByOrgDomain: Map<string, boolean>;
  domainReviewByOrgDomain: Map<string, boolean>;
  assignedChangeIds: Set<string>;
  explicitChangeIds: Set<string>;
};

function key(orgId: string, domain: string | null | undefined) {
  return `${orgId}:${String(domain ?? "REVENUE").toUpperCase()}`;
}

async function buildAccessContext(
  supabase: SupabaseClient,
  userId: string,
  orgIds: string[],
  changeIds: string[]
): Promise<AccessContext> {
  const [membershipRows, domainPermRows, assignedRows, explicitRows] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", userId)
        .in("org_id", orgIds),
      supabase
        .from("user_domain_permissions")
        .select("org_id, domain, can_view, can_review")
        .eq("user_id", userId)
        .in("org_id", orgIds),
      changeIds.length
        ? supabase
            .from("approvals")
            .select("change_event_id")
            .eq("approver_user_id", userId)
            .in("change_event_id", changeIds)
        : Promise.resolve({ data: [] as Array<{ change_event_id: string }> }),
      changeIds.length
        ? supabase
            .from("change_permissions")
            .select("change_event_id")
            .eq("user_id", userId)
            .eq("access_type", "VIEW")
            .is("expires_at", null)
            .in("change_event_id", changeIds)
        : Promise.resolve({ data: [] as Array<{ change_event_id: string }> }),
    ]);

  const roleByOrgId = new Map<string, OrgRole>(
    (membershipRows.data ?? []).map((m) => [m.org_id, parseOrgRole(m.role ?? null)])
  );
  const domainViewByOrgDomain = new Map<string, boolean>();
  const domainReviewByOrgDomain = new Map<string, boolean>();
  for (const row of domainPermRows.data ?? []) {
    const k = key(row.org_id, row.domain);
    domainViewByOrgDomain.set(k, Boolean(row.can_view));
    domainReviewByOrgDomain.set(k, Boolean(row.can_review));
  }

  return {
    roleByOrgId,
    domainViewByOrgDomain,
    domainReviewByOrgDomain,
    assignedChangeIds: new Set((assignedRows.data ?? []).map((a) => a.change_event_id)),
    explicitChangeIds: new Set((explicitRows.data ?? []).map((e) => e.change_event_id)),
  };
}

export function canViewChangeWithContext(
  userId: string,
  row: ChangeVisibilityRow,
  ctx: AccessContext
): boolean {
  const role = ctx.roleByOrgId.get(row.org_id) ?? parseOrgRole(null);
  const isAdminLike = role === "OWNER" || role === "ADMIN";
  if (isAdminLike) return true;

  const isCreator = row.created_by === userId;
  const isAssigned = ctx.assignedChangeIds.has(row.id);
  const hasExplicit = ctx.explicitChangeIds.has(row.id);
  const restricted = Boolean(row.is_restricted);

  if (restricted) {
    return isCreator || isAssigned || hasExplicit;
  }

  const st = String(row.status ?? "");
  const domainKey = key(row.org_id, row.domain);
  const hasDomainView = ctx.domainViewByOrgDomain.has(domainKey)
    ? Boolean(ctx.domainViewByOrgDomain.get(domainKey))
    : true;

  if (role === "REVIEWER") {
    return isAssigned || (hasDomainView && (st === "IN_REVIEW" || st === "APPROVED"));
  }
  if (role === "SUBMITTER") {
    return isCreator || isAssigned || (hasDomainView && st === "APPROVED");
  }
  return hasDomainView && st === "APPROVED";
}

export async function canViewChange(
  supabase: SupabaseClient,
  userId: string,
  row: ChangeVisibilityRow
): Promise<boolean> {
  const ctx = await buildAccessContext(supabase, userId, [row.org_id], [row.id]);
  return canViewChangeWithContext(userId, row, ctx);
}

export async function filterVisibleChanges<T extends ChangeVisibilityRow>(
  supabase: SupabaseClient,
  userId: string,
  rows: T[]
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const orgIds = [...new Set(rows.map((r) => r.org_id))];
  const changeIds = rows.map((r) => r.id);
  const ctx = await buildAccessContext(supabase, userId, orgIds, changeIds);
  return rows.filter((row) => canViewChangeWithContext(userId, row, ctx));
}

export async function canReviewDomain(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  domain: string | null | undefined
): Promise<boolean> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = parseOrgRole((member as { role?: string | null } | null)?.role ?? null);
  if (!canRole(role, "change.approve")) return false;
  if (role === "OWNER" || role === "ADMIN") return true;

  const { data: perm } = await supabase
    .from("user_domain_permissions")
    .select("can_review")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("domain", String(domain ?? "REVENUE"))
    .maybeSingle();
  if (!perm) return true;
  return Boolean((perm as { can_review?: boolean | null }).can_review);
}

export async function canGrantRestrictedAccess(
  supabase: SupabaseClient,
  userId: string,
  change: Pick<ChangeVisibilityRow, "org_id" | "created_by">
): Promise<boolean> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", change.org_id)
    .eq("user_id", userId)
    .maybeSingle();
  const role = parseOrgRole((member as { role?: string | null } | null)?.role ?? null);
  if (role === "OWNER" || role === "ADMIN") return true;
  return change.created_by === userId;
}
