import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { generateInviteToken } from "@/lib/inviteToken";
import { sendInviteEmail } from "@/services/invites/sendInviteEmail";
import { env } from "@/lib/env";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

const INVITE_EXPIRY_DAYS = 7;
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

/**
 * POST /api/org/invites — Create an invite (admin only).
 * Body: { email: string, role: string, orgId?: string }. If orgId omitted, use first admin org.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;

  const auth = await requireAdminOrg(supabase);
  if (auth.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { email?: string; role?: string; orgId?: string };
  try {
    body = (await req.json()) as { email?: string; role?: string; orgId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const role = typeof body.role === "string" && isAllowedRole(body.role) ? body.role : "viewer";
  const orgId = typeof body.orgId === "string" ? body.orgId : auth.orgId!;
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

  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();
  const orgName = (org as { name?: string } | null)?.name ?? "the organization";

  const { data: pendingInvite } = await admin
    .from("org_invites")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email", email)
    .eq("status", "PENDING")
    .maybeSingle();

  if (pendingInvite) {
    await admin.from("org_invites").update({ status: "REVOKED", updated_at: new Date().toISOString() }).eq("id", pendingInvite.id);
  }

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const { data: invite, error: insertErr } = await admin
    .from("org_invites")
    .insert({
      org_id: orgId,
      email,
      role,
      token_hash: tokenHash,
      status: "PENDING",
      invited_by_user_id: auth.user!.id,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const acceptLink = `${env.appUrl.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(token)}`;
  const inviterName = auth.user!.email ?? null;
  const sendResult = await sendInviteEmail({
    to: email,
    orgName,
    inviterName,
    role,
    acceptLink,
    expiresInDays: INVITE_EXPIRY_DAYS,
  });

  if (!sendResult.sent) {
    console.warn("[org/invites] invite email failed:", sendResult.error);
  }

  await auditLog(admin, {
    orgId,
    actorId: auth.user!.id,
    actorType: "USER",
    action: "invite_created",
    entityType: "org_invite",
    entityId: invite.id,
    metadata: { email, role, inviteId: invite.id },
  });

  return NextResponse.json({
    ok: true,
    inviteId: invite.id,
    email,
    role,
    expiresAt: expiresAt.toISOString(),
    emailSent: sendResult.sent,
  });
}

/**
 * GET /api/org/invites?orgId= — List pending invites (admin only).
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
  const { data: invites, error } = await admin
    .from("org_invites")
    .select("id, email, role, status, expires_at, created_at, invited_by_user_id")
    .eq("org_id", orgId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = invites ?? [];
  const inviterIds = [...new Set(list.map((i) => (i as { invited_by_user_id?: string | null }).invited_by_user_id).filter(Boolean))] as string[];
  const inviterEmailById = new Map<string, string>();
  for (const uid of inviterIds) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) inviterEmailById.set(uid, u.user.email);
    } catch {
      // ignore
    }
  }

  const invitesWithInviter = list.map((inv) => {
    const inviterId = (inv as { invited_by_user_id?: string | null }).invited_by_user_id ?? null;
    return {
      ...inv,
      invited_by_email: inviterId ? inviterEmailById.get(inviterId) ?? null : null,
    };
  });

  return NextResponse.json({ invites: invitesWithInviter });
}
