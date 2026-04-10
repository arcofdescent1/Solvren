import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { buildExecutiveChangeView } from "@/lib/executive/buildExecutiveChangeView";
import { parseOrgRole } from "@/lib/rbac/roles";
import { ORG_ATTENTION_SETTINGS_SELECT, resolveOrgAttentionSettings } from "./orgAttentionDefaults";
import { getRoutingPersona } from "./getRoutingPersona";
import type { AttentionContext, MemberRoutingInfo, PendingApprovalRow } from "./types";

const MAX_MEMBERS = 400;

/**
 * Single aggregation path: executive view + org settings + memberships + approvals.
 * Does not call routeAttention.
 */
export async function buildAttentionContext(
  supabase: SupabaseClient,
  changeId: string
): Promise<AttentionContext | null> {
  const view = await buildExecutiveChangeView(supabase, changeId);
  if (!view) return null;

  const { data: meta, error: metaErr } = await scopeActiveChangeEvents(
    supabase.from("change_events").select("org_id, created_by, domain")
  )
    .eq("id", changeId)
    .maybeSingle();

  if (metaErr || !meta) return null;

  const orgId = String((meta as { org_id: string }).org_id);
  const createdByUserId =
    (meta as { created_by?: string | null }).created_by != null
      ? String((meta as { created_by?: string | null }).created_by)
      : null;
  const domain = (meta as { domain?: string | null }).domain ?? null;

  const [{ data: settingsRow }, { data: memberRows }, { data: roleRows }, { data: approvalRows }] =
    await Promise.all([
      supabase
        .from("organization_settings")
        .select(ORG_ATTENTION_SETTINGS_SELECT)
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase.from("organization_members").select("user_id, role").eq("org_id", orgId).limit(MAX_MEMBERS),
      supabase.from("organization_member_roles").select("user_id, role_key").eq("org_id", orgId),
      supabase
        .from("approvals")
        .select("id, approval_area, decision, approver_user_id")
        .eq("change_event_id", changeId),
    ]);

  const settings = resolveOrgAttentionSettings(settingsRow as Record<string, unknown> | null);

  const keysByUser = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const uid = String((r as { user_id: string }).user_id);
    const key = String((r as { role_key?: string }).role_key ?? "").toUpperCase();
    if (!key) continue;
    const cur = keysByUser.get(uid) ?? [];
    cur.push(key);
    keysByUser.set(uid, cur);
  }

  const members: MemberRoutingInfo[] = (memberRows ?? []).map((row) => {
    const userId = String((row as { user_id: string }).user_id);
    const orgRole = parseOrgRole((row as { role?: string | null }).role ?? null);
    const roleKeysUpper = keysByUser.get(userId) ?? [];
    const persona = getRoutingPersona({ orgRole, roleKeysUpper });
    return { userId, orgRole, roleKeysUpper, persona };
  });

  const approvals = (approvalRows ?? []) as PendingApprovalRow[];
  const executiveSignoffRequired = approvals.some(
    (a) => String(a.approval_area ?? "").toUpperCase() === "EXEC" && a.decision === "PENDING"
  );

  const candidateRecipientUserIds = members.map((m) => m.userId);

  return {
    orgId,
    changeId,
    createdByUserId,
    view,
    settings,
    members,
    approvals,
    domain,
    executiveSignoffRequired,
    candidateRecipientUserIds,
  };
}
