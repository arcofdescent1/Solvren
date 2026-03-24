/**
 * GET /api/integrations/salesforce/objects
 * List Salesforce objects (sobjects). Returns recommended CRM objects or live list if connected.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";
import { env } from "@/lib/env";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

const RECOMMENDED_OBJECTS = [
  { name: "Opportunity", label: "Opportunity", recommended: true },
  { name: "Quote", label: "Quote", recommended: true },
  { name: "Contract", label: "Contract", recommended: true },
  { name: "Order", label: "Order", recommended: true },
  { name: "PricebookEntry", label: "Price Book Entry", recommended: true },
  { name: "Campaign", label: "Campaign", recommended: false },
  { name: "Lead", label: "Lead", recommended: false },
];

export async function GET(req: NextRequest) {
  try {
    if (!env.salesforceIntegrationEnabled) return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("id, environment, instance_url, auth_mode")
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("client_id, client_secret, salesforce_username, jwt_private_key_base64")
    .eq("org_id", ctx.orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (!sfOrg || !credsRaw) {
    return NextResponse.json({
      objects: RECOMMENDED_OBJECTS,
      connected: false,
      source: "default",
    });
  }

  const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>) as {
    client_id?: string;
    client_secret?: string;
    salesforce_username?: string;
    jwt_private_key_base64?: string;
  };

  const authMode = (sfOrg as { auth_mode: string }).auth_mode;
  const clientId = creds.client_id;
  const clientSecret = creds.client_secret;
  const envType = (sfOrg as { environment: string }).environment as "production" | "sandbox";

  if (!clientId) {
    return NextResponse.json({ objects: RECOMMENDED_OBJECTS, connected: false, source: "default" });
  }

  const client = new SalesforceClient({
    environment: envType,
    instanceUrl: (sfOrg as { instance_url?: string }).instance_url,
    clientId,
    clientSecret: clientSecret ?? "",
    authMode: authMode as "jwt_bearer" | "client_credentials",
    username: (creds as { salesforce_username?: string }).salesforce_username ?? undefined,
    jwtPrivateKeyBase64: (creds as { jwt_private_key_base64?: string }).jwt_private_key_base64 ?? undefined,
  });

  try {
    const { sobjects } = await client.listSobjects();
    const recommended = new Set(RECOMMENDED_OBJECTS.map((o) => o.name));
    const objects = sobjects
      .filter((s) => !s.name.endsWith("__x") && !s.name.endsWith("__mdt") && !s.name.endsWith("__e"))
      .map((s) => ({ name: s.name, label: s.label, recommended: recommended.has(s.name) }))
      .sort((a, b) => (a.recommended === b.recommended ? 0 : a.recommended ? -1 : 1));

    return NextResponse.json({
      objects: objects.length > 0 ? objects : RECOMMENDED_OBJECTS,
      connected: true,
      source: "salesforce",
    });
    } catch {
      return NextResponse.json({
        objects: RECOMMENDED_OBJECTS,
        connected: true,
        source: "default",
      });
    }
  } catch (e) {
    return authzErrorResponse(e);
  }
}
