/**
 * Phase 1 — GET /api/integrations/:provider/status (§15.1).
 * Returns account status for the current org's installation of this provider.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { getAccountByOrgAndProvider } from "@/modules/integrations/core/integrationAccountsRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

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
    const ctx = orgIdRaw
      ? await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.view")
      : await resolveDefaultOrgForUser();

    const { data: account, error } = await getAccountByOrgAndProvider(ctx.supabase, ctx.orgId, provider);
    if (error) {
      return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
    }

    const health = (account?.health_summary_json ?? {}) as Record<string, string>;
    const scopeCoverage = {
      requiredGranted: (account?.scopes_granted_json ?? []).length,
      requiredMissing: (account?.scopes_missing_json ?? []).length,
      optionalGranted: 0,
      optionalMissing: 0,
    };

    return NextResponse.json({
      ok: true,
      data: {
        provider,
        status: account?.status ?? "not_installed",
        environment: "production",
        installedAt: account?.installed_at ?? null,
        lastSuccessAt: account?.last_success_at ?? null,
        lastErrorAt: account?.last_error_at ?? null,
        health,
        scopeCoverage,
        objectCoverage: [],
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
