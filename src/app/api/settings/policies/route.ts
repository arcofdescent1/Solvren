import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrg } from "@/lib/org/requireAdminOrg";
import { auditLog } from "@/lib/audit";

type CreateBody = {
  name: string;
  description?: string;
  rule_type: string;
  rule_config?: Record<string, unknown>;
  systems_affected?: string[];
  enforcement_mode: "MONITOR" | "REQUIRE_APPROVAL" | "BLOCK";
  enabled?: boolean;
  priority?: number;
};

export async function GET() {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Admin role required" }, { status: auth.status });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("revenue_policies")
    .select("*")
    .eq("org_id", auth.orgId)
    .order("priority", { ascending: false })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, policies: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAdminOrg();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Admin role required" }, { status: auth.status });
  }
  let body: CreateBody;
  try { body = (await req.json()) as CreateBody; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = String(body.name ?? "").trim();
  const ruleType = String(body.rule_type ?? "CUSTOM").trim();
  const mode = body.enforcement_mode;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!["MONITOR", "REQUIRE_APPROVAL", "BLOCK"].includes(mode)) {
    return NextResponse.json({ error: "Invalid enforcement_mode" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("revenue_policies").insert({
    org_id: auth.orgId,
    name,
    description: body.description ?? null,
    rule_type: ruleType,
    rule_config: body.rule_config ?? {},
    systems_affected: body.systems_affected ?? [],
    enforcement_mode: mode,
    enabled: body.enabled ?? true,
    priority: Number(body.priority ?? 100),
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auditLog(auth.supabase, { orgId: auth.orgId, actorId: auth.user!.id, action: "revenue_policy_created", entityType: "revenue_policy", entityId: data.id, metadata: { name, rule_type: ruleType, enforcement_mode: mode } });
  return NextResponse.json({ ok: true, policy: data });
}
