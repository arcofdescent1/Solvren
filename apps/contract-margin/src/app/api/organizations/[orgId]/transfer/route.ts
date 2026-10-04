import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requestOwner, verifyRecentTotp } from "@/lib/api";

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOwner(orgId);
  if (!session) return jsonError("Owner access with MFA is required.", 403);
  const parsed = z.strictObject({ userId: z.uuid(), code: z.string() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || !await verifyRecentTotp(session.supabase, parsed.data.code ?? "")) {
    return jsonError("Authenticator code was not accepted.", 403);
  }
  const { error } = await session.supabase.rpc("transfer_organization_ownership", {
    p_org: orgId, p_user: parsed.data.userId,
  });
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ transferred: true });
}
