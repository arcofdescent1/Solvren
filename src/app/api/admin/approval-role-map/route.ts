import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

type CreateBody = {
  domain_key: string;
  role_label: string;
  approval_area: string;
};

async function requireAdminOrg(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { user: null, orgId: null, status: 401 as const };
  const { data: orgRow } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const row = orgRow as { org_id?: string; role?: string } | null;
  if (!row?.org_id) return { user: userRes.user, orgId: null, status: 401 as const };
  if (!isAdminLikeRole(parseOrgRole(row.role ?? null)))
    return { user: userRes.user, orgId: row.org_id, status: 403 as const };
  return { user: userRes.user, orgId: row.org_id, status: null };
}

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const domain =
    new URL(req.url).searchParams.get("domain") ?? "REVENUE";

  const { data, error } = await supabase
    .from("approval_role_map")
    .select("id, domain_key, role_label, approval_area, created_at")
    .eq("domain_key", domain)
    .order("role_label", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403)
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });

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

  const orgId = auth.orgId as string;
  const admin = createAdminClient();

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
    actorId: auth.user!.id,
    action: "APPROVAL_ROLE_MAP_CREATED",
    entityType: "approval_role_map",
    entityId: (data as { id?: string } | null)?.id ?? null,
    metadata: { row: data },
  });

  return NextResponse.json({ ok: true, row: data });
}
