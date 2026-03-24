/**
 * Phase 3 — BigQuery read-only client.
 */
import { BigQuery } from "@google-cloud/bigquery";
import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export async function getBigQueryClientForAccount(
  integrationAccountId: string
): Promise<BigQuery | null> {
  const admin = createAdminClient();
  const { data: configRow } = await admin
    .from("integration_source_configs")
    .select("config_json")
    .eq("integration_account_id", integrationAccountId)
    .eq("provider_key", "bigquery")
    .eq("status", "active")
    .maybeSingle();

  const { data: credsRow } = await admin
    .from("integration_accounts")
    .select("org_id")
    .eq("id", integrationAccountId)
    .maybeSingle();

  if (!configRow || !credsRow) return null;

  const orgId = (credsRow as { org_id: string }).org_id;
  const { data: cred } = await admin
    .from("integration_credentials")
    .select("access_token, client_secret")
    .eq("org_id", orgId)
    .eq("provider", "bigquery")
    .maybeSingle();

  if (!cred) return null;

  const config = (configRow as { config_json: Record<string, unknown> }).config_json;
  const creds = revealCredentialTokenFields(cred as Record<string, unknown>) as { access_token?: string; client_secret?: string };
  const keyJson = creds.access_token ?? creds.client_secret;
  if (!keyJson) return null;

  try {
    const key = typeof keyJson === "string" ? JSON.parse(keyJson) : keyJson;
    return new BigQuery({ credentials: key, projectId: config.projectId as string });
  } catch {
    return null;
  }
}
