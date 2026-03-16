import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { hashInviteToken } from "@/lib/inviteToken";

/**
 * POST /api/org/invites/accept — Accept an invite with the given token.
 * Requires signed-in, verified user. Email must match invite email.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;

  let body: { token?: string };
  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const admin = createAdminClient();
  const tokenHash = hashInviteToken(token);

  const { data: invite, error: inviteErr } = await admin
    .from("org_invites")
    .select("id, org_id, email, role, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const status = invite.status as string;
  const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : true;

  if (status !== "PENDING") {
    return NextResponse.json(
      { error: status === "ACCEPTED" ? "This invitation was already used." : "This invitation is no longer valid." },
      { status: 400 }
    );
  }
  if (isExpired) {
    return NextResponse.json({ error: "This invitation has expired." }, { status: 400 });
  }

  const userEmail = (userRes.user.email ?? "").toLowerCase();
  const inviteEmail = (invite.email ?? "").toLowerCase();
  if (userEmail !== inviteEmail) {
    return NextResponse.json(
      { error: "email_mismatch", message: "This invite was sent to a different email. Sign in with that email to accept.", inviteEmail },
      { status: 403 }
    );
  }

  const { data: existing } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("org_id", invite.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("org_invites")
      .update({
        status: "ACCEPTED",
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userRes.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id);
    return NextResponse.json({ ok: true, alreadyMember: true, orgId: invite.org_id });
  }

  const { error: memErr } = await admin.from("organization_members").insert({
    org_id: invite.org_id,
    user_id: userRes.user.id,
    role: invite.role,
  });

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  const { error: updateErr } = await admin
    .from("org_invites")
    .update({
      status: "ACCEPTED",
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: userRes.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await auditLog(admin, {
    orgId: invite.org_id,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "invite_accepted",
    entityType: "org_invite",
    entityId: invite.id,
    metadata: { email: invite.email, role: invite.role },
  });

  return NextResponse.json({ ok: true, orgId: invite.org_id });
}
