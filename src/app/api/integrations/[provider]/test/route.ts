/**
 * Phase 1 — POST /api/integrations/:provider/test (§15.1).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getRegistryRuntime, hasProvider } from "@/modules/integrations/registry/providerRegistry";
import type { IntegrationProvider } from "@/modules/integrations/contracts/types";
import { auditLog } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!hasProvider(provider)) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const orgIdRaw = (body.orgId ?? body.org_id) as string | undefined;
    const integrationAccountId = (body.integrationAccountId ?? body.integration_account_id) as string | undefined;

    let ctx: Awaited<ReturnType<typeof requireOrgPermission>>;
    let accountId: string;

    if (integrationAccountId) {
      const supabase = await createServerSupabaseClient();
      const { data: account } = await getAccountById(supabase, integrationAccountId);
      if (!account) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
      }
      ctx = await requireOrgPermission(parseRequestedOrgId(account.org_id), "integrations.view");
      accountId = account.id;
    } else if (orgIdRaw) {
      ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.view");
      const { data: account } = await getAccountByOrgAndProvider(ctx.supabase, ctx.orgId, provider);
      if (!account) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Integration not installed" } }, { status: 404 });
      }
      accountId = account.id;
    } else {
      ctx = await resolveDefaultOrgForUser();
      const { data: account } = await getAccountByOrgAndProvider(ctx.supabase, ctx.orgId, provider);
      if (!account) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Integration not installed" } }, { status: 404 });
      }
      accountId = account.id;
    }

    const { data: account } = await getAccountById(ctx.supabase, accountId);
    if (!account) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
    }

    const runtime = getRegistryRuntime(provider as IntegrationProvider);
    const result = await runtime.testConnection({ orgId: account.org_id, integrationAccountId: account.id });
    await auditLog(ctx.supabase, {
      orgId: account.org_id,
      actorId: ctx.user.id,
      actorType: "USER",
      action: "integration.test.run",
      entityType: "integration_account",
      entityId: account.id,
      metadata: { provider, success: result.success, message: result.message ?? null },
    });
    return NextResponse.json({
      ok: result.success,
      data: { success: result.success, message: result.message, details: result.details },
      error: result.success ? undefined : { code: "test_failed", message: result.message ?? "Connection test failed" },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
