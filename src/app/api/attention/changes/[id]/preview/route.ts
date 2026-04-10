import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { canViewChange } from "@/lib/access/changeAccess";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { hasPermissionInOrg } from "@/lib/rbac/can";
import { parseOrgRole } from "@/lib/rbac/roles";
import { buildAttentionContext } from "@/lib/attention/buildAttentionContext";
import { routeAttention } from "@/lib/attention/routeAttention";
import type { AttentionEventType } from "@/lib/attention/types";

/**
 * GET /api/attention/changes/[id]/preview — operator/admin only; routing strategy preview.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;

  const { data: change, error: ceErr } = await scopeActiveChangeEvents(
    supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted")
  )
    .eq("id", changeId)
    .maybeSingle();

  if (ceErr || !change) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orgId = change.org_id as string;
  const canView = await canViewChange(supabase, userRes.user.id, change);
  if (!canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  const role = parseOrgRole((member as { role?: string | null } | null)?.role ?? null);
  const isOwnerAdmin = role === "OWNER" || role === "ADMIN";
  const canApprove = await hasPermissionInOrg(supabase, userRes.user.id, orgId, "change.approve");
  const canManageSettings = await hasPermissionInOrg(supabase, userRes.user.id, orgId, "org.settings.manage");

  if (!isOwnerAdmin && !canApprove && !canManageSettings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const ctx = await buildAttentionContext(admin, changeId);
  if (!ctx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const eventType: AttentionEventType = "CHANGE_UPDATED";
  const routes = routeAttention({ eventType, context: ctx });

  return NextResponse.json({
    changeId,
    routes: routes.map((r) => ({
      userId: r.userId,
      userName: r.userId,
      persona: r.persona,
      routeType: r.routeType,
      channel: r.channel,
      requiresAction: r.requiresAction,
      actionType: r.actionType,
      reason: r.reason,
    })),
  });
}
