/**
 * Phase 1 — GET /api/integrations/:provider/object-coverage (§15.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getSupportedObjectsByAccountId } from "@/modules/integrations/core/integrationSupportedObjectsRepo";
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
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId or integrationAccountId required" } }, { status: 400 });
    }

    const { data: objects, error } = await getSupportedObjectsByAccountId(ctx.supabase, accountId);
    if (error) {
      return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
    }
    const coverage = objects.map((o) => ({
      objectType: o.object_type,
      readEnabled: o.read_enabled,
      writeEnabled: o.write_enabled,
      eventEnabled: o.event_enabled,
      backfillComplete: o.backfill_complete,
      lastSyncedAt: o.last_synced_at,
    }));
    return NextResponse.json({
      ok: true,
      data: coverage,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
