/**
 * GET /api/integrations/salesforce/objects/[sobject]/fields
 * Describe Salesforce object to get field metadata.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";
import { env } from "@/lib/env";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sobject: string }> }
) {
  try {
    if (!env.salesforceIntegrationEnabled) return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });
    const orgId = req.nextUrl.searchParams.get("orgId");
    const objectName = (await params).sobject;
    if (!orgId || !objectName) return NextResponse.json({ error: "orgId and sobject required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("environment, instance_url, auth_mode")
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("client_id, client_secret, salesforce_username, jwt_private_key_base64")
    .eq("org_id", ctx.orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (!sfOrg || !credsRaw) return NextResponse.json({ error: "Salesforce not connected" }, { status: 400 });

  const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>) as {
    client_id: string;
    client_secret?: string;
    salesforce_username?: string;
    jwt_private_key_base64?: string;
  };

  const client = new SalesforceClient({
    environment: (sfOrg as { environment: string }).environment as "production" | "sandbox",
    instanceUrl: (sfOrg as { instance_url: string }).instance_url,
    clientId: creds.client_id,
    clientSecret: creds.client_secret ?? "",
    authMode: (sfOrg as { auth_mode: string }).auth_mode as "jwt_bearer" | "client_credentials",
    username: creds.salesforce_username ?? undefined,
    jwtPrivateKeyBase64: creds.jwt_private_key_base64 ?? undefined,
  });

  try {
    const { fields } = await client.describeSobject(objectName);
    return NextResponse.json({ fields });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to describe object" },
      { status: 500 }
    );
  }
} catch (e) {
  return authzErrorResponse(e);
}
}
