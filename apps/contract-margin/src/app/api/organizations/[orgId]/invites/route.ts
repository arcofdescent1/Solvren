import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { applicationOrigin } from "@/lib/env";
import { jsonError, requestOwner, verifyRecentTotp } from "@/lib/api";

const schema = z.strictObject({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["finance", "engineer", "viewer"]),
  code: z.string(),
});

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOwner(orgId);
  if (!session) return jsonError("Owner access with MFA is required.", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a valid email and role.", 400);
  if (!await verifyRecentTotp(session.supabase, parsed.data.code)) return jsonError("Authenticator code was not accepted.", 403);
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!key || !from) return jsonError("Invitation email is not configured.", 503);
  let origin: string;
  try { origin = applicationOrigin(); }
  catch { return jsonError("Application origin is not configured.", 503); }
  const { data: org } = await session.supabase.from("organizations").select("name").eq("id", orgId).single();
  if (!org) return jsonError("Organization not found.", 404);
  const { data, error } = await session.supabase.rpc("create_organization_invite", {
    p_org: orgId, p_email: parsed.data.email, p_role: parsed.data.role,
  });
  if (error || !data?.[0]) return jsonError(error?.message ?? "Invitation could not be created.", 400);
  const invite = data[0] as { invite_id: string; invite_token: string };
  const link = `${origin}/invite/${invite.invite_token}`;
  try {
    const delivery = await new Resend(key).emails.send({
      from, to: parsed.data.email,
      subject: `Join ${org.name} on Solvren`,
      text: `You were invited to join ${org.name} on Solvren as ${parsed.data.role}. This link expires in seven days: ${link}`,
    });
    if (delivery.error) throw delivery.error;
  } catch {
    await session.supabase.rpc("revoke_organization_invite", { p_invite: invite.invite_id });
    return jsonError("Invitation email could not be delivered. Try again.", 502);
  }
  return NextResponse.json({ inviteId: invite.invite_id }, { status: 201 });
}
