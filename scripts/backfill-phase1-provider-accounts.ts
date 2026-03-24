/**
 * Backfill missing integration_accounts rows for Phase 1 providers.
 * Run with: npx tsx scripts/backfill-phase1-provider-accounts.ts
 */
import { createClient } from "@supabase/supabase-js";
import { upsertProviderIntegrationAccount } from "../src/modules/integrations/core/providerAccountLinkService";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // eslint-disable-next-line no-console
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  let linked = 0;

  const { data: jiraRows } = await admin
    .from("integration_connections")
    .select("org_id, config")
    .eq("provider", "jira")
    .in("status", ["connected", "configured"]);
  for (const row of (jiraRows ?? []) as Array<{ org_id: string; config?: { cloudId?: string; siteName?: string } }>) {
    await upsertProviderIntegrationAccount(admin, {
      orgId: row.org_id,
      provider: "jira",
      status: "connected",
      metadata: { cloudId: row.config?.cloudId ?? null, siteName: row.config?.siteName ?? null },
    });
    linked++;
  }

  const { data: slackRows } = await admin
    .from("slack_installations")
    .select("org_id, team_id, team_name, status");
  for (const row of (slackRows ?? []) as Array<{ org_id: string; team_id?: string; team_name?: string; status?: string }>) {
    if (row.status !== "ACTIVE") continue;
    await upsertProviderIntegrationAccount(admin, {
      orgId: row.org_id,
      provider: "slack",
      status: "connected",
      metadata: { teamId: row.team_id ?? null, teamName: row.team_name ?? null },
    });
    linked++;
  }

  const { data: githubRows } = await admin
    .from("github_installations")
    .select("org_id, github_installation_id, github_account_login");
  for (const row of (githubRows ?? []) as Array<{ org_id: string; github_installation_id?: number; github_account_login?: string }>) {
    await upsertProviderIntegrationAccount(admin, {
      orgId: row.org_id,
      provider: "github",
      status: "connected",
      metadata: { installationId: row.github_installation_id ?? null, accountLogin: row.github_account_login ?? null },
    });
    linked++;
  }

  const { data: netsuiteRows } = await admin
    .from("netsuite_accounts")
    .select("org_id, account_id, account_name, environment");
  for (const row of (netsuiteRows ?? []) as Array<{ org_id: string; account_id?: string; account_name?: string; environment?: string }>) {
    await upsertProviderIntegrationAccount(admin, {
      orgId: row.org_id,
      provider: "netsuite",
      status: "connected",
      metadata: {
        accountId: row.account_id ?? null,
        accountName: row.account_name ?? null,
        environment: row.environment ?? null,
      },
      config: row.environment ? { environment: row.environment } : undefined,
    });
    linked++;
  }

  // eslint-disable-next-line no-console
  console.log(`Backfill complete. Processed ${linked} provider records.`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
