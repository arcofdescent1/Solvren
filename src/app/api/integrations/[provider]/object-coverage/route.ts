/**
 * Phase 1 — GET /api/integrations/:provider/object-coverage (§15.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getSupportedObjectsByAccountId } from "@/modules/integrations/core/integrationSupportedObjectsRepo";
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

  let accountId = integrationAccountId;
  if (!accountId && orgId) {
    const { data: account } = await getAccountByOrgAndProvider(supabase, orgId, provider);
    accountId = account?.id ?? undefined;
  }
  if (!accountId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId or integrationAccountId required" } }, { status: 400 });
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

  const { data: objects, error } = await getSupportedObjectsByAccountId(supabase, accountId);
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
}
