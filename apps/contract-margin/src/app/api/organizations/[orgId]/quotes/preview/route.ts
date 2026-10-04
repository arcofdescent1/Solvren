import { z } from "zod";
import { jsonError, requestOrgWriteRole } from "@/lib/api";
import { quoteScenarioSchema } from "@/lib/quote-finance";
import { quoteEvidence } from "@/lib/quote-service";

const schema = z.strictObject({ scenarios: z.array(quoteScenarioSchema).min(1).max(3) });

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgWriteRole(orgId, ["owner", "finance"]);
  if (!session) return jsonError("Finance access with MFA required.", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid quote assumptions.", 400);
  try { return Response.json(await quoteEvidence(session.supabase, orgId, parsed.data.scenarios),
    { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return jsonError(error instanceof Error ? error.message : "Quote calculation failed.", 400); }
}
