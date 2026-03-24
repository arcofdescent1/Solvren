/**
 * Phase 1 — GET /api/integrations/:provider/details (§15.1). Account + object coverage + recent activity.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getSupportedObjectsByAccountId } from "@/modules/integrations/core/integrationSupportedObjectsRepo";
import { getSyncJobsByAccountId } from "@/modules/integrations/core/integrationSyncJobsRepo";
import { getActionLogsByAccountId } from "@/modules/integrations/core/integrationActionLogsRepo";
import { getWebhookEventsByAccountId } from "@/modules/integrations/core/integrationWebhookRepo";
import { listInboundEventsByAccountId } from "@/modules/integrations/reliability/repositories/integration-inbound-events.repository";
import { getProviderManifest } from "@/modules/integrations/registry/getProviderManifest";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!hasProvider(provider)) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
    }

    const orgId = req.nextUrl.searchParams.get("orgId");
    const integrationAccountId = req.nextUrl.searchParams.get("integrationAccountId");
    const limit = Math.min(20, parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10);

    let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
    let accountId: string | null;

    if (integrationAccountId) {
      const supabase = await createServerSupabaseClient();
      const { data: account } = await getAccountById(supabase, integrationAccountId);
      if (!account) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
      }
      ctx = await requireOrgPermission(parseRequestedOrgId(account.org_id), "integrations.view");
      accountId = integrationAccountId;
    } else if (orgId) {
      ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
      const { data: account } = await getAccountByOrgAndProvider(ctx.supabase, ctx.orgId, provider);
      accountId = account?.id ?? null;
    } else {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId or integrationAccountId required" } }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({
        ok: true,
        data: { account: null, manifest: getProviderManifest(provider) ?? null, objectCoverage: [], activity: { syncJobs: [], actionLogs: [], webhookEvents: [], inboundEvents: [] } },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const { data: account } = await getAccountById(ctx.supabase, accountId!);
    if (!account || account.org_id !== ctx.orgId) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
    }

    const [objectsRes, syncRes, actionRes, webhookRes, inboundRes] = await Promise.all([
      getSupportedObjectsByAccountId(ctx.supabase, accountId),
      getSyncJobsByAccountId(ctx.supabase, accountId, limit),
      getActionLogsByAccountId(ctx.supabase, accountId, limit),
      getWebhookEventsByAccountId(ctx.supabase, accountId, limit),
      listInboundEventsByAccountId(ctx.supabase, accountId, limit),
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
        inboundEvents: (inboundRes.data ?? []).map((e) => ({
          id: e.id,
          eventType: e.event_type,
          ingestStatus: e.ingest_status,
          receivedAt: e.received_at,
        })),
      },
    },
    meta: { timestamp: new Date().toISOString() },
  });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
