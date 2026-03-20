/**
 * Phase 1 — GET /api/integrations/:provider/details (§15.1). Account + object coverage + recent activity.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getSupportedObjectsByAccountId } from "@/modules/integrations/core/integrationSupportedObjectsRepo";
import { getSyncJobsByAccountId } from "@/modules/integrations/core/integrationSyncJobsRepo";
import { getActionLogsByAccountId } from "@/modules/integrations/core/integrationActionLogsRepo";
import { getWebhookEventsByAccountId } from "@/modules/integrations/core/integrationWebhookRepo";
import { getProviderManifest } from "@/modules/integrations/registry/getProviderManifest";
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
  const limit = Math.min(20, parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10);

  let accountId = integrationAccountId;
  if (!accountId && orgId) {
    const { data: account } = await getAccountByOrgAndProvider(supabase, orgId, provider);
    accountId = account?.id ?? undefined;
  }
  if (!accountId) {
    return NextResponse.json({
      ok: true,
      data: { account: null, manifest: getProviderManifest(provider) ?? null, objectCoverage: [], activity: { syncJobs: [], actionLogs: [], webhookEvents: [] } },
      meta: { timestamp: new Date().toISOString() },
    });
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

  const [objectsRes, syncRes, actionRes, webhookRes] = await Promise.all([
    getSupportedObjectsByAccountId(supabase, accountId),
    getSyncJobsByAccountId(supabase, accountId, limit),
    getActionLogsByAccountId(supabase, accountId, limit),
    getWebhookEventsByAccountId(supabase, accountId, limit),
  ]);

  const objectCoverage = (objectsRes.data ?? []).map((o) => ({
    objectType: o.object_type,
    readEnabled: o.read_enabled,
    writeEnabled: o.write_enabled,
    eventEnabled: o.event_enabled,
    backfillComplete: o.backfill_complete,
    lastSyncedAt: o.last_synced_at,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      account: {
        id: account.id,
        provider: account.provider,
        displayName: account.display_name,
        status: account.status,
        lastSuccessAt: account.last_success_at,
        lastErrorAt: account.last_error_at,
        lastErrorMessage: account.last_error_message,
        healthSummary: account.health_summary_json,
        scopesGranted: account.scopes_granted_json,
        scopesMissing: account.scopes_missing_json,
      },
      manifest: getProviderManifest(provider) ?? null,
      objectCoverage,
      activity: {
        syncJobs: syncRes.data,
        actionLogs: actionRes.data,
        webhookEvents: webhookRes.data,
      },
    },
    meta: { timestamp: new Date().toISOString() },
  });
}
