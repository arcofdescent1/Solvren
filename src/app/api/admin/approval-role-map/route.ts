import { NextResponse } from "next/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { auditLog } from "@/lib/audit";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

type CreateBody = {
  domain_key: string;
  role_label: string;
  approval_area: string;
};

export async function GET(req: Request) {
  try {
    const ctx = await requireAnyOrgPermission("approval.mappings.manage");
    const supabase = ctx.supabase;

    const domain =
      new URL(req.url).searchParams.get("domain") ?? "REVENUE";

    const { data, error } = await supabase
      .from("approval_role_map")
      .select("id, domain_key, role_label, approval_area, created_at")
      .eq("domain_key", domain)
      .order("role_label", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAnyOrgPermission("approval.mappings.manage");
    const supabase = ctx.supabase;

    let body: CreateBody;
    try {
      body = (await req.json()) as CreateBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.role_label?.trim() || !body.approval_area?.trim()) {
      return NextResponse.json(
        { error: "role_label and approval_area required" },
        { status: 400 }
      );
    }

    const orgId = ctx.orgId;
    const admin = createPrivilegedClient("POST /api/admin/approval-role-map: insert approval_role_map");

    const { data, error } = await admin
      .from("approval_role_map")
      .insert({
        domain_key: body.domain_key ?? "REVENUE",
        role_label: body.role_label.trim(),
        approval_area: body.approval_area.trim(),
      })
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(supabase, {
      orgId,
      actorId: ctx.user.id,
      action: "APPROVAL_ROLE_MAP_CREATED",
      entityType: "approval_role_map",
      entityId: (data as { id?: string } | null)?.id ?? null,
      metadata: { row: data },
    });

    return NextResponse.json({ ok: true, row: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
