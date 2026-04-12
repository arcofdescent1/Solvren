import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { maybeLogInternalTabView } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";
import { fullNameFromAuthUser } from "@/lib/internal/resolveAuthProfile";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "team_access", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await maybeLogInternalTabView(gate.ctx.admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    tab: "team_access",
  });

  const admin = gate.ctx.admin;
  const { data: rows, error } = await admin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members: {
    userId: string;
    email: string | null;
    fullName: string | null;
    role: string;
    joinedAt: string;
  }[] = [];

  for (const row of rows ?? []) {
    const userId = String((row as { user_id?: string }).user_id ?? "");
    const role = String((row as { role?: string }).role ?? "viewer").toLowerCase();
    const joinedAt = (row as { created_at?: string }).created_at ?? new Date().toISOString();
    let email: string | null = null;
    let fullName: string | null = null;
    try {
      const { data: u } = await admin.auth.admin.getUserById(userId);
      email = u?.user?.email ?? null;
      fullName = fullNameFromAuthUser(u?.user ?? undefined);
    } catch {
      /* ignore */
    }
    members.push({ userId, email, fullName, role, joinedAt });
  }

  return NextResponse.json({ members });
}
