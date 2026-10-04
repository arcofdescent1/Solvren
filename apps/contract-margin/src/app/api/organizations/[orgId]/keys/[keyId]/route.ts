import { z } from "zod";
import { jsonError, requestOrgRole, verifyRecentTotp } from "@/lib/api";

export async function DELETE(request: Request, context: { params: Promise<{ orgId: string; keyId: string }> }) {
  const { orgId, keyId } = await context.params;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(keyId).success)
    return jsonError("Key not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "engineer"]);
  if (!session) return jsonError("Engineer access with MFA required.", 403);
  const body = z.strictObject({ code: z.string() }).safeParse(await request.json().catch(() => null));
  if (!body.success || !await verifyRecentTotp(session.supabase, body.data.code))
    return jsonError("Authenticator code was not accepted.", 403);
  const { error } = await session.supabase.rpc("revoke_ingestion_key", { p_org: orgId, p_key: keyId });
  if (error) return jsonError(error.message, 400);
  return Response.json({ revoked: true });
}
