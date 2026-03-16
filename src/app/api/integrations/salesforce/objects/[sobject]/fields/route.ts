/**
 * GET /api/integrations/salesforce/objects/[sobject]/fields
 * Describe Salesforce object to get field metadata.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";
import { env } from "@/lib/env";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sobject: string }> }
) {
  if (!env.salesforceIntegrationEnabled) return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const orgId = req.nextUrl.searchParams.get("orgId");
  const objectName = (await params).sobject;
  if (!orgId || !objectName) return NextResponse.json({ error: "orgId and sobject required" }, { status: 400 });

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("environment, instance_url, auth_mode")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: creds } = await admin
    .from("integration_credentials")
    .select("client_id, client_secret, salesforce_username, jwt_private_key_base64")
    .eq("org_id", orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (!sfOrg || !creds) return NextResponse.json({ error: "Salesforce not connected" }, { status: 400 });

  const client = new SalesforceClient({
    environment: (sfOrg as { environment: string }).environment as "production" | "sandbox",
    instanceUrl: (sfOrg as { instance_url: string }).instance_url,
    clientId: (creds as { client_id: string }).client_id,
    clientSecret: (creds as { client_secret?: string }).client_secret ?? "",
    authMode: (sfOrg as { auth_mode: string }).auth_mode as "jwt_bearer" | "client_credentials",
    username: (creds as { salesforce_username?: string }).salesforce_username ?? undefined,
    jwtPrivateKeyBase64: (creds as { jwt_private_key_base64?: string }).jwt_private_key_base64 ?? undefined,
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
}
