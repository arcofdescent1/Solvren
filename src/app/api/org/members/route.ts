import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { createPrivilegedClient } from "@/lib/server/adminClient";

export type OrgMemberRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: "Active" | "Unverified";
  joined_at: string;
};

/**
 * GET /api/org/members?orgId= — List org members (org.users.manage).
 */
export async function GET(req: NextRequest) {
  try {
    const paramOrg = new URL(req.url).searchParams.get("orgId");
    const ctx = paramOrg
      ? await requireOrgPermission(parseRequestedOrgId(paramOrg), "org.users.manage")
      : await requireOrgPermission((await resolveDefaultOrgForUser()).orgId, "org.users.manage");

    const orgId = ctx.orgId;
    const admin = createPrivilegedClient("GET /api/org/members: list members + auth.admin.getUserById for emails");
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
        /* leave null */
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
  } catch (e) {
    return authzErrorResponse(e);
  }
}
