/**
 * Phase 1 — POST /api/integrations/:provider/sync (§15.1). Queue backfill or incremental sync.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { queueBackfill } from "@/modules/integrations/sync/syncOrchestrator";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!hasProvider(provider)) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
    }

    let body: { orgId?: string; integrationAccountId?: string; objectTypes?: string[] };
    try {
      body = (await req.json()) as { orgId?: string; integrationAccountId?: string; objectTypes?: string[] };
    } catch {
      body = {};
    }
    const orgIdRaw = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    let integrationAccountId = body.integrationAccountId;

    let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
    if (integrationAccountId) {
      const supabase = await createServerSupabaseClient();
      const { data: account } = await getAccountById(supabase, integrationAccountId);
      if (!account) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
      }
      ctx = await requireOrgPermission(parseRequestedOrgId(account.org_id), "integrations.manage");
    } else if (orgIdRaw) {
      ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");
      const { data: account } = await getAccountByOrgAndProvider(ctx.supabase, ctx.orgId, provider);
      integrationAccountId = account?.id;
    } else {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId and integration account required" } }, { status: 400 });
    }

    if (!integrationAccountId) {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId and integration account required" } }, { status: 400 });
    }

    const { data: account } = await getAccountById(ctx.supabase, integrationAccountId);
    if (!account || account.org_id !== ctx.orgId) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
    }

    const result = await queueBackfill(ctx.supabase, {
      orgId: ctx.orgId,
      integrationAccountId,
      objectTypes: body.objectTypes,
      triggerSource: "manual",
    });

    if (result.error) {
      return NextResponse.json({ ok: false, error: { code: "sync_failed", message: result.error } }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      data: { jobId: result.jobId, status: "queued" },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
