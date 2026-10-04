import { z } from "zod";
import { jsonError, requestOrgRole } from "@/lib/api";

const money = z.string().regex(/^\d+(\.\d{1,8})?$/);
const schema = z.strictObject({
  provider: z.enum(["openai", "anthropic"]), model: z.string().trim().min(1).max(200),
  effectiveFrom: z.iso.date(), input: money, output: money,
  cacheRead: money, cacheWrite: money,
});

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "finance", "engineer"]);
  if (!session) return jsonError("Finance or Engineer access with MFA required.", 403);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter valid provider pricing per million tokens.", 400);
  const { data, error } = await session.supabase.rpc("create_model_rate", {
    p_org: orgId, p_provider: body.data.provider, p_model: body.data.model,
    p_effective_from: body.data.effectiveFrom, p_input: body.data.input,
    p_output: body.data.output, p_cache_read: body.data.cacheRead,
    p_cache_write: body.data.cacheWrite,
  });
  if (error) return jsonError(error.message, 400);
  return Response.json({ id: data }, { status: 201 });
}
