/**
 * Phase 4 — POST /api/integrations/:provider/reconcile (§9.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";
import { getAccountByOrgAndProvider } from "@/modules/integrations/core/integrationAccountsRepo";
import { runStripeReconcile } from "@/modules/integrations/providers/stripe/reconcile";
import { runHubSpotReconcile } from "@/modules/integrations/providers/hubspot/reconcile";

const RECONCILE_PROVIDERS = ["stripe", "hubspot"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!hasProvider(provider)) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Unknown provider" } }, { status: 404 });
    }
    if (!RECONCILE_PROVIDERS.includes(provider)) {
      return NextResponse.json({ ok: false, error: { code: "not_supported", message: `Reconcile not supported for ${provider}` } }, { status: 400 });
    }

    let body: { orgId?: string };
    try {
      body = (await req.json()) as { orgId?: string };
    } catch {
      body = {};
    }
    const orgId = body.orgId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
    }

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const { data: account } = await getAccountByOrgAndProvider(ctx.supabase, orgId, provider);
    if (!account) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Integration account not found" } }, { status: 404 });
    }

    const admin = createAdminClient();

    if (provider === "stripe") {
      const result = await runStripeReconcile(admin, { orgId, integrationAccountId: account.id });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: { code: "reconcile_failed", message: result.error } }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        data: { eventsFetched: result.eventsFetched, eventsIngested: result.eventsIngested },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    if (provider === "hubspot") {
      const result = await runHubSpotReconcile(admin, { orgId, integrationAccountId: account.id });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: { code: "reconcile_failed", message: result.error } }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        data: { recordsFetched: result.recordsFetched, eventsIngested: result.eventsIngested },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    return NextResponse.json({ ok: false, error: { code: "not_supported", message: "Provider not implemented" } }, { status: 400 });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
