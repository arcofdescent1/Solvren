import { z } from "zod";
import { jsonError, requestOrgRole, verifyRecentTotp } from "@/lib/api";

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "engineer"]);
  if (!session) return jsonError("Engineer access with MFA required.", 403);
  const body = z.strictObject({ label: z.string().trim().min(1).max(80), code: z.string() })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter a key label and authenticator code.", 400);
  if (!await verifyRecentTotp(session.supabase, body.data.code)) return jsonError("Authenticator code was not accepted.", 403);
  const { data, error } = await session.supabase.rpc("issue_ingestion_key", {
    p_org: orgId, p_label: body.data.label,
  });
  if (error || !data?.[0]) return jsonError(error?.message ?? "Could not create key.", 400);
  return Response.json({ id: data[0].key_id, token: data[0].token }, { status: 201,
    headers: { "Cache-Control": "no-store" } });
}
