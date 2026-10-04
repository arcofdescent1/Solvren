import { z } from "zod";
import { jsonError, requestOrgRole, verifyRecentTotp } from "@/lib/api";
import { fetchCostDay } from "@/lib/provider-cost";
import { verifyStripeKey } from "@/lib/stripe-revenue";

const provider = z.enum(["openai", "anthropic", "stripe"]);
const createSchema = z.strictObject({ provider, key: z.string().min(16).max(8192),
  code: z.string().regex(/^\d{6}$/) });
const deleteSchema = z.strictObject({ provider, code: z.string().regex(/^\d{6}$/) });
type Context = { params: Promise<{ orgId: string }> };

async function sessionFor(orgId: string, kind: z.infer<typeof provider>) {
  return requestOrgRole(orgId, kind === "stripe" ? ["owner", "finance"] : ["owner", "engineer"]);
}

export async function POST(request: Request, context: Context) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter a provider, credential, and current authenticator code.", 400);
  const session = await sessionFor(orgId, body.data.provider);
  if (!session || !await verifyRecentTotp(session.supabase, body.data.code))
    return jsonError("Your role and a fresh authenticator code are required.", 403);
  try {
    if (body.data.provider === "stripe") await verifyStripeKey(body.data.key);
    else {
      const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
      await fetchCostDay(body.data.provider, body.data.key, yesterday);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Provider verification failed";
    return jsonError(/^((openai|anthropic) cost API returned HTTP \d{3}|Stripe (customers|subscriptions|invoices) API returned HTTP \d{3}|Use a Stripe restricted key with read access only)$/.test(detail)
      ? detail : "Credential verification failed. Confirm admin read access and provider account type.", 400);
  }
  const { error } = await session.supabase.rpc("save_provider_connection", {
    p_org: orgId, p_provider: body.data.provider, p_secret: body.data.key,
  });
  if (error) return jsonError(error.message, 400);
  const { error: queueError } = await session.supabase.rpc("queue_connector_backfill", {
    p_org: orgId, p_provider: body.data.provider, p_days: 30,
  });
  if (queueError) return jsonError("Connection saved; initial sync could not be queued. Use Sync now.", 503);
  return Response.json({ connected: true, backfillDays: body.data.provider === "stripe" ? null : 30 }, { status: 201 });
}

export async function DELETE(request: Request, context: Context) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const body = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter a provider and authenticator code.", 400);
  const session = await sessionFor(orgId, body.data.provider);
  if (!session || !await verifyRecentTotp(session.supabase, body.data.code))
    return jsonError("Your role and a fresh authenticator code are required.", 403);
  const { error } = await session.supabase.rpc("remove_provider_connection", {
    p_org: orgId, p_provider: body.data.provider,
  });
  if (error) return jsonError(error.message, 400);
  return Response.json({ disconnected: true });
}
