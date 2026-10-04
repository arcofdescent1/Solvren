import { z } from "zod";
import { jsonError, requestOrgRole, verifyRecentTotp } from "@/lib/api";
import { langfuseRegions } from "@/lib/langfuse";

const provider = z.enum(["openai", "anthropic"]);
const connect = z.strictObject({ provider, region: z.enum(["us", "eu", "jp", "hipaa_us"]),
  publicKey: z.string().min(8).max(500), secretKey: z.string().min(8).max(500), code: z.string() });

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "engineer"]);
  if (!session) return jsonError("Engineer access with MFA required.", 403);
  const body = connect.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter a provider, Langfuse region, keys, and authenticator code.", 400);
  if (!await verifyRecentTotp(session.supabase, body.data.code)) return jsonError("Authenticator code was not accepted.", 403);
  let response: Response;
  try {
    response = await fetch(`${langfuseRegions[body.data.region]}/api/public/projects`, {
      headers: { Authorization: `Basic ${Buffer.from(`${body.data.publicKey}:${body.data.secretKey}`).toString("base64")}` },
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
  } catch { return jsonError("Langfuse could not be reached. Check its region and try again.", 502); }
  if (!response.ok) return jsonError("Langfuse did not accept these credentials.", 422);
  const { error } = await session.supabase.rpc("store_langfuse_connection", {
    p_org: orgId, p_provider: body.data.provider, p_public_key: body.data.publicKey,
    p_secret_key: body.data.secretKey, p_region: body.data.region,
  });
  if (error) return jsonError("Connection could not be stored.", 503);
  return Response.json({ connected: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "engineer"]);
  if (!session) return jsonError("Engineer access with MFA required.", 403);
  const body = z.strictObject({ provider, code: z.string() }).safeParse(await request.json().catch(() => null));
  if (!body.success || !await verifyRecentTotp(session.supabase, body.data.code))
    return jsonError("Authenticator code was not accepted.", 403);
  const { error } = await session.supabase.rpc("disconnect_langfuse_connection", {
    p_org: orgId, p_provider: body.data.provider,
  });
  if (error) return jsonError("Connection could not be removed.", 503);
  return Response.json({ disconnected: true });
}
