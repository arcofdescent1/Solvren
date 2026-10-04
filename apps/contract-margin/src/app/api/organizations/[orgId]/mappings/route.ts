import { z } from "zod";
import { jsonError, requestOrgRole } from "@/lib/api";

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "finance", "engineer"]);
  if (!session) return jsonError("Finance or Engineer access with MFA required.", 403);
  const body = z.strictObject({ source: z.string().min(1).max(80),
    sourceCustomerId: z.string().min(1).max(200), customerId: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Choose a customer mapping.", 400);
  const { error } = await session.supabase.rpc("set_customer_mapping", {
    p_org: orgId, p_source: body.data.source,
    p_source_customer_id: body.data.sourceCustomerId, p_customer: body.data.customerId,
  });
  if (error) return jsonError(error.message, 400);
  return Response.json({ mapped: true });
}
