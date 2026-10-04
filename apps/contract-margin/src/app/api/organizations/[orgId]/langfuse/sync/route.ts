import { z } from "zod";
import { jsonError, requestOrgWriteRole } from "@/lib/api";
import { dateRange } from "@/lib/finance";

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgWriteRole(orgId, ["owner", "engineer"]);
  if (!session) return jsonError("Engineer access with MFA required.", 403);
  const body = z.strictObject({ provider: z.enum(["openai", "anthropic"]),
    from: z.iso.date(), to: z.iso.date() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Choose a provider and date range.", 400);
  const period = dateRange({ from: body.data.from, to: body.data.to });
  if (!period || period.days > 31) return jsonError("Langfuse sync covers 1 to 31 days.", 400);
  const { data, error } = await session.supabase.rpc("queue_langfuse_sync", {
    p_org: orgId, p_provider: body.data.provider,
    p_start: `${period.from}T00:00:00Z`, p_end: `${period.to}T00:00:00Z`,
  });
  if (error) return jsonError(error.message, 400);
  return Response.json({ jobId: data }, { status: 202 });
}
