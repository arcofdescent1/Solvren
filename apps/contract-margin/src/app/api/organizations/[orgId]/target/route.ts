import { z } from "zod";
import { jsonError, requestOrgWriteRole } from "@/lib/api";

const schema = z.strictObject({ targetMarginPct: z.string().regex(/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/) });

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgWriteRole(orgId, ["owner", "finance"]);
  if (!session) return jsonError("Finance access with MFA required.", 403);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter a percentage from 0 to 100 with at most two decimals.", 400);
  const { error } = await session.supabase.rpc("set_org_target_margin", {
    p_org: orgId, p_target: body.data.targetMarginPct,
  });
  if (error) return jsonError(error.message, 400);
  return Response.json({ ok: true });
}
