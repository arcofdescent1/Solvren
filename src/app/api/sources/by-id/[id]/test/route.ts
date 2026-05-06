import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgMembership,
} from "@/lib/server/authz";
import { assertCanTestCustomSource } from "@/lib/server/intakeAuthz";
import {
  decryptAdhocSecretWithAudit,
  userCredentialReveal,
} from "@/modules/integrations/secrets/integration-secrets.service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(req.url);
    const orgId = parseRequestedOrgId(url.searchParams.get("orgId"));
    const session = await requireOrgMembership(orgId);
    const reveal = userCredentialReveal(orgId, "custom_source_webhook", session.user.id, "manual_retry");
    assertCanTestCustomSource(session.role);

    const { id } = await ctx.params;
    const admin = createAdminClient();
    const { data: source, error } = await admin
      .from("custom_sources")
      .select("org_id, webhook_secret_ciphertext, webhook_path_key")
      .eq("id", id)
      .maybeSingle();

    if (error || !source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((source as { org_id: string }).org_id !== orgId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    let secret: string;
    try {
      secret = decryptAdhocSecretWithAudit(
        (source as { webhook_secret_ciphertext: string }).webhook_secret_ciphertext,
        { ...reveal, secretField: "webhook_secret_ciphertext" },
      )!;
    } catch {
      return NextResponse.json({ error: "Secret not readable (encryption keys?)" }, { status: 500 });
    }

    const sample = JSON.stringify({ ping: true, at: new Date().toISOString() });
    const sig = createHmac("sha256", secret).update(sample, "utf8").digest("hex");
    const base = new URL(req.url).origin;
    const webhookPathKey = (source as { webhook_path_key: string }).webhook_path_key;
    const ingestUrl = `${base}/api/public/sources/${webhookPathKey}/ingest`;

    return NextResponse.json({
      ok: true,
      ingestUrl,
      sampleBody: sample,
      sampleSignatureHeader: sig,
      headerName: "X-Solvren-Signature",
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
