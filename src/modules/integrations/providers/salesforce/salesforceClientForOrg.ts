/**
 * Phase 2 — Get Salesforce client for org.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";

export async function getSalesforceClientForOrg(orgId: string): Promise<SalesforceClient | null> {
  const admin = createAdminClient();
  const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("environment, instance_url, auth_mode")
    .eq("org_id", orgId)
    .maybeSingle();
  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("client_id, client_secret, salesforce_username, jwt_private_key_base64")
    .eq("org_id", orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (!sfOrg || !credsRaw) return null;

  const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>) as {
    client_id: string;
    client_secret?: string;
    salesforce_username?: string;
    jwt_private_key_base64?: string;
  };

  return new SalesforceClient({
    environment: (sfOrg as { environment: string }).environment as "production" | "sandbox",
    instanceUrl: (sfOrg as { instance_url: string }).instance_url,
    clientId: creds.client_id,
    clientSecret: creds.client_secret ?? "",
    authMode: (sfOrg as { auth_mode: string }).auth_mode as "jwt_bearer" | "client_credentials",
    username: creds.salesforce_username ?? undefined,
    jwtPrivateKeyBase64: creds.jwt_private_key_base64 ?? undefined,
  });
}
