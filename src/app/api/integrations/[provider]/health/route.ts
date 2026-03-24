/**
 * GET /api/integrations/:provider/health
 * Runtime-based health endpoint for all providers.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getRegistryRuntime, hasProvider } from "@/modules/integrations/registry/providerRegistry";
import type { IntegrationProvider } from "@/modules/integrations/contracts/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!hasProvider(provider)) {
      return NextResponse.json(
        { ok: false, error: { code: "not_found", message: "Unknown provider" } },
        { status: 404 }
      );
    }
    const orgIdRaw = req.nextUrl.searchParams.get("orgId");
    const accountIdRaw = req.nextUrl.searchParams.get("integrationAccountId");

    let accountId: string;
    let orgId: string;
    if (accountIdRaw) {
      const ctx = orgIdRaw
        ? await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.view")
        : await resolveDefaultOrgForUser();
      const { data: account } = await getAccountById(ctx.supabase, accountIdRaw);
      if (!account || account.provider !== provider) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
      }
      if (account.org_id !== ctx.orgId) {
        return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
      }
      accountId = account.id;
      orgId = account.org_id;
    } else {
      const ctx = orgIdRaw
        ? await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.view")
        : await resolveDefaultOrgForUser();
      const { data: account } = await getAccountByOrgAndProvider(ctx.supabase, ctx.orgId, provider);
      if (!account) {
        return NextResponse.json({ ok: false, error: { code: "not_found", message: "Integration not installed" } }, { status: 404 });
      }
      accountId = account.id;
      orgId = account.org_id;
    }

    const runtime = getRegistryRuntime(provider as IntegrationProvider);
    const health = await runtime.getHealth({ orgId, integrationAccountId: accountId });
    return NextResponse.json({
      ok: true,
      data: {
        provider,
        integrationAccountId: accountId,
        health,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
