import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requestOwner, verifyRecentTotp } from "@/lib/api";

type Context = { params: Promise<{ orgId: string; userId: string }> };

async function ownerAndBody(request: Request, context: Context) {
  const { orgId, userId } = await context.params;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(userId).success) return null;
  const session = await requestOwner(orgId);
  if (!session) return null;
  const body = await request.json().catch(() => null);
  return { orgId, userId, session, body };
}

export async function PATCH(request: Request, context: Context) {
  const input = await ownerAndBody(request, context);
  if (!input) return jsonError("Owner access with MFA is required.", 403);
  const parsed = z.strictObject({ role: z.enum(["finance", "engineer", "viewer"]), code: z.string() }).safeParse(input.body);
  if (!parsed.success) return jsonError("Select a role and enter your authenticator code.", 400);
  if (!await verifyRecentTotp(input.session.supabase, parsed.data.code)) return jsonError("Authenticator code was not accepted.", 403);
  const { error } = await input.session.supabase.rpc("change_organization_member_role", {
    p_org: input.orgId, p_user: input.userId, p_role: parsed.data.role,
  });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request, context: Context) {
  const input = await ownerAndBody(request, context);
  if (!input) return jsonError("Owner access with MFA is required.", 403);
  const parsed = z.strictObject({ code: z.string() }).safeParse(input.body);
  if (!parsed.success || !await verifyRecentTotp(input.session.supabase, parsed.data.code ?? "")) {
    return jsonError("Authenticator code was not accepted.", 403);
  }
  const { error } = await input.session.supabase.rpc("remove_organization_member", {
    p_org: input.orgId, p_user: input.userId,
  });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ removed: true });
}
