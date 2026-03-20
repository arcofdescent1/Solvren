/**
 * Phase 1 — POST /api/integrations/:provider/test (§15.1).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getRegistryRuntime, hasProvider } from "@/modules/integrations/registry/providerRegistry";
import type { IntegrationProvider } from "@/modules/integrations/contracts/types";

export async function POST(
  req: Request,
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

  const body = await req.json().catch(() => ({}));
  const orgId = (body.orgId ?? body.org_id) as string | undefined;
  const integrationAccountId = (body.integrationAccountId ?? body.integration_account_id) as string | undefined;

  let accountId: string;
  if (integrationAccountId) {
    const { data: account } = await getAccountById(supabase, integrationAccountId);
    if (!account) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
    }
    accountId = account.id;
  } else if (orgId) {
    const { data: account } = await getAccountByOrgAndProvider(supabase, orgId, provider);
    if (!account) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Integration not installed" } }, { status: 404 });
    }
    accountId = account.id;
  } else {
    const { data: memberships } = await supabase.from("organization_members").select("org_id").eq("user_id", userRes.user.id);
    const firstOrgId = (memberships ?? [])[0]?.org_id;
    if (!firstOrgId) {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId or integrationAccountId required" } }, { status: 400 });
    }
    const { data: account } = await getAccountByOrgAndProvider(supabase, firstOrgId, provider);
    if (!account) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Integration not installed" } }, { status: 404 });
    }
    accountId = account.id;
  }

  const { data: account } = await getAccountById(supabase, accountId);
  if (!account) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
  }

  const runtime = getRegistryRuntime(provider as IntegrationProvider);
  const result = await runtime.testConnection({ orgId: account.org_id, integrationAccountId: account.id });
  return NextResponse.json({
    ok: result.success,
    data: { success: result.success, message: result.message, details: result.details },
    error: result.success ? undefined : { code: "test_failed", message: result.message ?? "Connection test failed" },
    meta: { timestamp: new Date().toISOString() },
  });
}
