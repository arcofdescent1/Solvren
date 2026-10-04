import { z } from "zod";
import { jsonError, requestOrgWriteRole } from "@/lib/api";

const schema = z.strictObject({ provider: z.enum(["openai", "anthropic", "stripe"]),
  days: z.number().int().min(1).max(31).default(30) });

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Choose a provider and 1–31 days.", 400);
  const roles = body.data.provider === "stripe" ? ["owner", "finance"] as const
    : ["owner", "engineer"] as const;
  const session = await requestOrgWriteRole(orgId, [...roles]);
  if (!session) return jsonError("Your role and MFA are required.", 403);
  const { data, error } = await session.supabase.rpc("queue_connector_backfill", {
    p_org: orgId, p_provider: body.data.provider, p_days: body.data.days,
  });
  if (error) return jsonError(error.message, 400);
  return Response.json({ queued: data }, { status: 202 });
}
