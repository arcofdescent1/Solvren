/**
 * Phase 1 — GET /api/integrations/:provider/activity (§13.4). Recent sync jobs, action logs, webhook events.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getSyncJobsByAccountId } from "@/modules/integrations/core/integrationSyncJobsRepo";
import { getActionLogsByAccountId } from "@/modules/integrations/core/integrationActionLogsRepo";
import { getWebhookEventsByAccountId } from "@/modules/integrations/core/integrationWebhookRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  const { provider } = await params;
  if (!hasProvider(provider)) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  const integrationAccountId = req.nextUrl.searchParams.get("integrationAccountId");
  const limit = Math.min(30, parseInt(req.nextUrl.searchParams.get("limit") ?? "15", 10) || 15);

  let accountId: string | null = integrationAccountId;
  if (!accountId && orgId) {
    const { data: account } = await getAccountByOrgAndProvider(supabase, orgId, provider);
    accountId = account?.id ?? null;
  }
  if (!accountId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId or integrationAccountId required" } }, { status: 400 });
  }

  const { data: account } = await getAccountById(supabase, accountId);
  if (!account) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
  }
  const { data: memberships } = await supabase.from("organization_members").select("org_id").eq("user_id", userRes.user.id);
  const orgIds = (memberships ?? []).map((m) => (m as { org_id: string }).org_id);
  if (!orgIds.includes(account.org_id)) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const [syncRes, actionRes, webhookRes] = await Promise.all([
    getSyncJobsByAccountId(supabase, accountId, limit),
    getActionLogsByAccountId(supabase, accountId, limit),
    getWebhookEventsByAccountId(supabase, accountId, limit),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      syncJobs: syncRes.data,
      actionLogs: actionRes.data,
      webhookEvents: webhookRes.data,
    },
    meta: { timestamp: new Date().toISOString() },
  });
}
