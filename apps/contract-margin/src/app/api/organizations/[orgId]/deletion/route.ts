import { z } from "zod";
import { jsonError, requestOwner, verifyRecentTotp } from "@/lib/api";

const schema = z.strictObject({ code: z.string().regex(/^\d{6}$/),
  confirmation: z.literal("DELETE MY ORGANIZATION") });

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOwner(orgId);
  if (!session) return jsonError("Owner access with MFA required.", 403);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success || !await verifyRecentTotp(session.supabase, body.data.code))
    return jsonError("Confirm the organization name and enter a fresh authenticator code.", 403);
  const { data, error } = await session.supabase.rpc("request_organization_deletion", { p_org: orgId });
  if (error) return jsonError(error.message, 400);
  return Response.json({ accessEnded: true, purgeAfter: data });
}
