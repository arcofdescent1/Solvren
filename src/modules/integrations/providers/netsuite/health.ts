import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { NetSuiteClient } from "@/services/netsuite/NetSuiteClient";
import type { IntegrationHealthReport, TestConnectionResult } from "../../contracts/runtime";

export async function testNetSuiteConnection(orgId: string): Promise<TestConnectionResult> {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("netsuite_accounts")
    .select("account_id, account_name")
    .eq("org_id", orgId)
    .maybeSingle();
  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("client_id, client_secret")
    .eq("org_id", orgId)
    .eq("provider", "netsuite")
    .maybeSingle();

  const creds = credsRaw ? revealCredentialTokenFields(credsRaw as Record<string, unknown>) : null;
  const accountId = (account as { account_id?: string } | null)?.account_id;
  const accountName = (account as { account_name?: string } | null)?.account_name ?? null;
  const clientId = (creds as { client_id?: string } | null)?.client_id;
  const clientSecret = (creds as { client_secret?: string } | null)?.client_secret;
  if (!accountId || !clientId || !clientSecret) return { success: false, message: "NetSuite not connected" };

  try {
    const client = new NetSuiteClient({ accountId, clientId, clientSecret });
    await client.testSuiteQL();
    return { success: true, message: "Connected", details: { accountId, accountName } };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "NetSuite validation failed" };
  }
}

export async function getNetSuiteHealth(orgId: string): Promise<IntegrationHealthReport> {
  const tested = await testNetSuiteConnection(orgId);
  return {
    status: tested.success ? "healthy" : "unhealthy",
    dimensions: {
      auth: tested.success ? "healthy" : "unhealthy",
      api_reachability: tested.success ? "healthy" : "unhealthy",
      install_completeness: tested.success ? "healthy" : "degraded",
    },
    summary: tested.message,
    lastCheckedAt: new Date().toISOString(),
  };
}
