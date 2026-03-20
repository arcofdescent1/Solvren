/**
 * Phase 3 — POST /api/admin/signals/warehouse-import (§17).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { processWarehouseImport } from "@/modules/signals/processing/warehouse-import.service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }

  let body: { orgId: string; rows: Array<{ provider: string; objectType: string; externalId: string; eventType: string; eventTime: string; payload: Record<string, unknown> }> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }
  if (!body.orgId || !Array.isArray(body.rows)) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId and rows required" } }, { status: 400 });
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

  const rows = body.rows.slice(0, 100).map((r) => ({
    orgId: body.orgId,
    provider: r.provider,
    objectType: r.objectType,
    externalId: r.externalId,
    eventType: r.eventType,
    eventTime: r.eventTime,
    payload: r.payload ?? {},
  }));

  const admin = createAdminClient();
  const result = await processWarehouseImport(admin, rows);

  return NextResponse.json({
    ok: true,
    data: result,
    meta: { timestamp: new Date().toISOString() },
  });
}
