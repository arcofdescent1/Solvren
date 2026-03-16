import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

async function requireAdminOrg(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return { user: null, orgId: null, status: 401 as const };
  const { data: row } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const r = row as { org_id?: string; role?: string } | null;
  if (!r?.org_id) return { user: userRes.user, orgId: null, status: 401 as const };
  if (!isAdminLikeRole(parseOrgRole(r.role ?? null))) {
    return { user: userRes.user, orgId: r.org_id, status: 403 as const };
  }
  return { user: userRes.user, orgId: r.org_id, status: null };
}

export type OrgMemberRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: "Active" | "Unverified";
  joined_at: string;
};

/**
 * GET /api/org/members?orgId= — List org members (admin only).
 * Returns members with email/name from auth when available.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = new URL(req.url).searchParams.get("orgId") ?? auth.orgId!;
  if (orgId !== auth.orgId) {
    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("org_id", orgId)
      .eq("user_id", auth.user!.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members: OrgMemberRow[] = [];
  for (const row of rows ?? []) {
    const userId = String((row as { user_id?: string }).user_id ?? "");
    const role = String((row as { role?: string }).role ?? "viewer");
    const createdAt = (row as { created_at?: string }).created_at ?? new Date().toISOString();
    let email: string | null = null;
    let name: string | null = null;
    let status: "Active" | "Unverified" = "Active";
    try {
      const { data: u } = await admin.auth.admin.getUserById(userId);
      if (u?.user) {
        email = u.user.email ?? null;
        const meta = u.user.user_metadata as Record<string, unknown> | undefined;
        name = (meta?.full_name as string) ?? (meta?.name as string) ?? null;
        status = u.user.email_confirmed_at ? "Active" : "Unverified";
      }
    } catch {
      // leave email/name null
    }
    members.push({
      user_id: userId,
      email,
      name,
      role,
      status,
      joined_at: createdAt,
    });
  }

  return NextResponse.json({ members });
}
