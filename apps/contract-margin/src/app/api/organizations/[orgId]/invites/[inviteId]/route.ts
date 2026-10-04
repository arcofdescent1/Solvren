import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requestOwner } from "@/lib/api";

export async function DELETE(_request: Request, context: { params: Promise<{ orgId: string; inviteId: string }> }) {
  const { orgId, inviteId } = await context.params;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(inviteId).success) return jsonError("Invitation not found.", 404);
  const session = await requestOwner(orgId);
  if (!session) return jsonError("Owner access with MFA is required.", 403);
  const { data: invite } = await session.supabase.from("organization_invites").select("id").eq("id", inviteId).eq("org_id", orgId).maybeSingle();
  if (!invite) return jsonError("Invitation not found.", 404);
  const { error } = await session.supabase.rpc("revoke_organization_invite", { p_invite: inviteId });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ revoked: true });
}
