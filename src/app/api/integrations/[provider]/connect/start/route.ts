/**
 * Phase 1 — POST /api/integrations/:provider/connect/start (§15.1).
 * Creates auth session and returns authorize URL for OAuth.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { startConnect } from "@/modules/integrations/auth/connectionManager";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import type { IntegrationProvider } from "@/modules/integrations/contracts/types";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!hasProvider(provider)) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
    }

    let body: { orgId?: string; redirectUri?: string };
    try {
      body = (await req.json()) as { orgId?: string; redirectUri?: string };
    } catch {
      body = {};
    }
    const orgId = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
    }

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");

    const baseUrl = req.nextUrl.origin;
    const redirectUri = body.redirectUri ?? `${baseUrl}/api/integrations/${provider}/connect/callback`;
    const stateToken = randomUUID();

    const result = await startConnect(ctx.supabase, {
    orgId: ctx.orgId,
    userId: ctx.user.id,
    provider: provider as IntegrationProvider,
    redirectUri,
    stateToken,
    requestedScopes: undefined,
  });

    if (result.error) {
      return NextResponse.json(
        { ok: false, error: { code: "start_failed", message: result.error } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: { authUrl: result.authUrl, stateToken: result.stateToken },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
