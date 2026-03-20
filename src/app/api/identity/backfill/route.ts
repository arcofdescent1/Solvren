/**
 * Phase 2 — POST /api/identity/backfill (§18.2). Internal backfill (changes, incidents).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { backfillInternal } from "@/modules/identity/backfill/backfillInternal";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  let body: { orgId: string; dryRun?: boolean; limit?: number };
  try {
    body = (await req.json()) as { orgId: string; dryRun?: boolean; limit?: number };
  } catch {
    body = { orgId: "" };
  }
  if (!body.orgId) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", body.orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const { isAdminLikeRole, parseOrgRole } = await import("@/lib/rbac/roles");
  if (!member || !isAdminLikeRole(parseOrgRole((member as { role: string | null }).role ?? null))) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Forbidden" } }, { status: 403 });
  }

  const result = await backfillInternal(supabase, body.orgId, {
    dryRun: body.dryRun ?? false,
    limit: body.limit,
  });
  return NextResponse.json({ ok: true, data: result });
}
