/**
 * Phase 1 — POST /api/integrations/:provider/sync (§15.1). Queue backfill or incremental sync.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { queueBackfill } from "@/modules/integrations/sync/syncOrchestrator";
import { getAccountByOrgAndProvider, getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export async function POST(
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

  let body: { orgId?: string; integrationAccountId?: string; objectTypes?: string[] };
  try {
    body = (await req.json()) as { orgId?: string; integrationAccountId?: string; objectTypes?: string[] };
  } catch {
    body = {};
  }
  const orgId = body.orgId ?? req.nextUrl.searchParams.get("orgId");
  let integrationAccountId = body.integrationAccountId;
  if (!integrationAccountId && orgId) {
    const { data: account } = await getAccountByOrgAndProvider(supabase, orgId, provider);
    integrationAccountId = account?.id;
  }
  if (!orgId || !integrationAccountId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId and integration account required" } }, { status: 400 });
  }

  const { data: account } = await getAccountById(supabase, integrationAccountId);
  if (!account || account.org_id !== orgId) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Account not found" } }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const result = await queueBackfill(supabase, {
    orgId,
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
}
