import { z } from "zod";
import { jsonError, requestOrgRole } from "@/lib/api";

export async function PATCH(request: Request, context: { params: Promise<{ orgId: string; customerId: string }> }) {
  const { orgId, customerId } = await context.params;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(customerId).success)
    return jsonError("Customer not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "finance"]);
  if (!session) return jsonError("Finance access with MFA required.", 403);
  const body = z.strictObject({ userId: z.uuid().nullable() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Choose an organization member.", 400);
  const { error } = await session.supabase.rpc("set_customer_owner", {
    p_org: orgId, p_customer: customerId, p_user: body.data.userId,
  });
  if (error) return jsonError(error.message, 400);
  return Response.json({ assigned: true });
}
