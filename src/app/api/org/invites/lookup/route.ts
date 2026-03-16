import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/inviteToken";

/**
 * GET /api/org/invites/lookup?token= — Returns invite details for the accept page.
 * Does not consume the invite. Returns 404 for invalid/expired/used.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const admin = createAdminClient();
  const tokenHash = hashInviteToken(token);

  const { data: invite, error } = await admin
    .from("org_invites")
    .select("id, org_id, email, role, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  const status = invite.status as string;
  const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : true;

  if (status !== "PENDING" || isExpired) {
    return NextResponse.json(
      { error: status === "ACCEPTED" ? "Invitation already used" : isExpired ? "Invitation expired" : "Invitation no longer valid", status: status === "ACCEPTED" ? "accepted" : isExpired ? "expired" : status.toLowerCase() },
      { status: 404 }
    );
  }

  const { data: org } = await admin.from("organizations").select("name").eq("id", invite.org_id).single();
  const orgName = (org as { name?: string } | null)?.name ?? "the organization";

  return NextResponse.json({
    orgName,
    role: invite.role,
    email: invite.email,
    status: "valid",
  });
}
