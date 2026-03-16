import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

const ALLOWED_ROLES = ["owner", "admin", "reviewer", "submitter", "viewer"] as const;

function isAllowedRole(r: string): r is (typeof ALLOWED_ROLES)[number] {
  return ALLOWED_ROLES.includes(r as (typeof ALLOWED_ROLES)[number]);
}

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

/** Count of members with role = owner in the org (used to protect last owner). */
async function countOwners(admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>, orgId: string) {
  const { count } = await admin
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner");
  return count ?? 0;
}

/**
 * PATCH /api/org/members/:userId — Update member role (admin only).
 * Body: { role: string }.
 * Cannot demote the last owner.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  let body: { role?: string };
  try {
    body = (await req.json()) as { role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const newRole = typeof body.role === "string" && isAllowedRole(body.role) ? body.role : null;
  if (!newRole) return NextResponse.json({ error: "Valid role required" }, { status: 400 });

  const admin = createAdminClient();
  const orgId = auth.orgId!;

  const { data: member } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const { data: actorMembership } = await admin
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", auth.user!.id)
    .maybeSingle();
  const actorRole = String((actorMembership as { role?: string } | null)?.role ?? "").toLowerCase();
  if (newRole === "owner" && actorRole !== "owner") {
    return NextResponse.json({ error: "Only owners can promote members to owner." }, { status: 403 });
  }

  const currentRole = String((member as { role?: string }).role ?? "");
  if (currentRole === "owner") {
    const ownerCount = await countOwners(admin, orgId);
    if (ownerCount <= 1 && newRole !== "owner") {
      return NextResponse.json(
        { error: "Cannot demote the last owner. Promote another member to owner first." },
        { status: 400 }
      );
    }
  }

  const { error } = await admin
    .from("organization_members")
    .update({ role: newRole })
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(admin, {
    orgId,
    actorId: auth.user!.id,
    actorType: "USER",
    action: "member_role_changed",
    entityType: "organization_member",
    entityId: userId,
    metadata: { previousRole: currentRole, newRole },
  });

  return NextResponse.json({ ok: true, role: newRole });
}

/**
 * DELETE /api/org/members/:userId — Remove member from org (admin only).
 * Cannot remove the last owner. Does not delete the user account.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const admin = createAdminClient();
  const orgId = auth.orgId!;

  const { data: member } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const role = String((member as { role?: string }).role ?? "");
  if (role === "owner") {
    const ownerCount = await countOwners(admin, orgId);
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last owner. Promote another member to owner first." },
        { status: 400 }
      );
    }
  }

  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(admin, {
    orgId,
    actorId: auth.user!.id,
    actorType: "USER",
    action: "member_removed",
    entityType: "organization_member",
    entityId: userId,
    metadata: { removedRole: role },
  });

  return NextResponse.json({ ok: true });
}
