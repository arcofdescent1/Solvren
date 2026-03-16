import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrg } from "@/lib/org/requireAdminOrg";
import { auditLog } from "@/lib/audit";

function isTableMissingError(err: { message?: string } | null): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("not found"))
  );
}

type CreateBody = {
  trigger_type: "DOMAIN" | "SYSTEM" | "CHANGE_TYPE";
  trigger_value: string;
  approval_role_id: string;
  priority?: number;
  enabled?: boolean;
};

export async function GET() {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Admin role required" },
      { status: auth.status }
    );
  }
  const admin = createAdminClient();
  const orgId = auth.orgId;

  const { data, error } = await admin
    .from("approval_mappings")
    .select(
      "id, trigger_type, trigger_value, approval_role_id, priority, enabled, created_at, updated_at, approval_roles!inner(id, role_name)"
    )
    .eq("org_id", orgId)
    .order("priority", { ascending: false })
    .order("trigger_type", { ascending: true })
    .order("trigger_value", { ascending: true });
  if (error) {
    if (isTableMissingError(error))
      return NextResponse.json({ ok: true, rows: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    trigger_type: r.trigger_type,
    trigger_value: r.trigger_value,
    approval_role_id: r.approval_role_id,
    priority: r.priority,
    enabled: r.enabled,
    created_at: r.created_at,
    updated_at: r.updated_at,
    role_name: (r as { approval_roles?: { role_name?: string } }).approval_roles?.role_name ?? "",
  }));

  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? "Unauthorized" : "Admin role required" },
      { status: auth.status }
    );
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const triggerType = body.trigger_type;
  const triggerValue = String(body.trigger_value ?? "").trim();
  const roleId = String(body.approval_role_id ?? "").trim();
  if (!["DOMAIN", "SYSTEM", "CHANGE_TYPE"].includes(triggerType)) {
    return NextResponse.json({ error: "Invalid trigger_type" }, { status: 400 });
  }
  if (!triggerValue) return NextResponse.json({ error: "trigger_value required" }, { status: 400 });
  if (!roleId) return NextResponse.json({ error: "approval_role_id required" }, { status: 400 });

  const admin = createAdminClient();
  const orgId = auth.orgId;

  const { data: role } = await admin
    .from("approval_roles")
    .select("id")
    .eq("org_id", orgId)
    .eq("id", roleId)
    .maybeSingle();
  if (!role) return NextResponse.json({ error: "Role not found in org" }, { status: 400 });

  const { data, error } = await admin
    .from("approval_mappings")
    .insert({
      org_id: orgId,
      trigger_type: triggerType,
      trigger_value: triggerValue,
      approval_role_id: roleId,
      priority: Number(body.priority ?? 100),
      enabled: body.enabled ?? true,
    })
    .select("id, trigger_type, trigger_value, approval_role_id, priority, enabled, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(auth.supabase, {
    orgId,
    actorId: auth.user!.id,
    action: "approval_mapping_created",
    entityType: "approval_mapping",
    entityId: data.id,
    metadata: { trigger_type: data.trigger_type, trigger_value: data.trigger_value },
  });

  return NextResponse.json({ ok: true, row: data });
}
