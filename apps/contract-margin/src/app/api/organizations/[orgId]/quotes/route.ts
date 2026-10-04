import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { jsonError, requestOrgRole } from "@/lib/api";
import { quoteReviewSchema } from "@/lib/quote-finance";
import { quoteEvidence } from "@/lib/quote-service";
import { adminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgRole(orgId, ["owner", "finance"]);
  if (!session) return jsonError("Finance access with MFA required.", 403);
  const parsed = quoteReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid quote review.", 400);
  const input = parsed.data;
  const admin = adminSupabase();
  const { data: member, error: memberError } = await admin.from("organization_members")
    .select("user_id").eq("org_id", orgId).eq("user_id", input.ownerUserId).maybeSingle();
  if (memberError || !member) return jsonError("Choose an active decision owner.", 400);
  let evidence: Awaited<ReturnType<typeof quoteEvidence>>;
  try { evidence = await quoteEvidence(session.supabase, orgId, input.scenarios); }
  catch (error) { return jsonError(error instanceof Error ? error.message : "Quote calculation failed.", 400); }
  const quoteId = input.quoteId ?? randomUUID();
  const snapshot = { customerName: input.customerName, ownerUserId: input.ownerUserId,
    decision: input.decision, notes: input.notes, ...evidence };
  const hash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: latest, error: latestError } = await admin.from("quote_decisions")
      .select("version").eq("org_id", orgId).eq("quote_id", quoteId)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (latestError) return jsonError("Could not read quote history.", 503);
    if (input.quoteId && !latest) return jsonError("Quote history not found.", 404);
    const version = (latest?.version ?? 0) + 1;
    const { data, error } = await admin.from("quote_decisions").insert({
      org_id: orgId, quote_id: quoteId, version,
      customer_name: input.customerName, owner_user_id: input.ownerUserId,
      decision: input.decision, notes: input.notes,
      scenario_input: input.scenarios, scenario_results: evidence.results,
      sample_snapshot: { samplePeriod: evidence.samplePeriod, samples: evidence.samples },
      formula_version: "2026-10-quote-v1", snapshot_hash: hash,
      saved_by: session.user.id,
    }).select("id").single();
    if (!error && data) return Response.json({ id: data.id, quoteId, version, ...evidence }, { status: 201 });
    if (error?.code !== "23505") return jsonError("Could not save quote decision.", 503);
  }
  return jsonError("Quote version changed during review. Retry the save.", 409);
}
