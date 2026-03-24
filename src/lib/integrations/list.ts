/**
 * Server-side integration list for an org. Used by settings page and GET /api/integrations/list.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationListEntry = {
  provider: "jira" | "github" | "netsuite" | "salesforce" | "hubspot" | "slack" | "stripe" | "csv" | "postgres_readonly" | "mysql_readonly" | "snowflake" | "bigquery";
  connected: boolean;
  meta?: Record<string, unknown>;
};

export type IntegrationsList = {
  jira: IntegrationListEntry & { provider: "jira" };
  github: IntegrationListEntry & { provider: "github" };
  netsuite: IntegrationListEntry & { provider: "netsuite" };
  salesforce: IntegrationListEntry & { provider: "salesforce" };
  hubspot: IntegrationListEntry & { provider: "hubspot" };
  slack: IntegrationListEntry & { provider: "slack" };
  stripe: IntegrationListEntry & { provider: "stripe" };
  csv: IntegrationListEntry & { provider: "csv" };
  postgres_readonly: IntegrationListEntry & { provider: "postgres_readonly" };
  mysql_readonly: IntegrationListEntry & { provider: "mysql_readonly" };
  snowflake: IntegrationListEntry & { provider: "snowflake" };
  bigquery: IntegrationListEntry & { provider: "bigquery" };
};

export async function getIntegrationsList(
  client: SupabaseClient,
  orgId: string
): Promise<IntegrationsList> {
  const [
    { data: allConns },
    { data: githubInst },
    { data: netsuiteAccount },
    { data: salesforceOrg },
    { data: hubspotAccount },
    { data: slackInstall },
    { data: dbAccounts },
  ] = await Promise.all([
    client.from("integration_connections").select("provider, status, config, health_status, last_success_at, last_error").eq("org_id", orgId),
    client.from("github_installations").select("github_installation_id, github_account_login").eq("org_id", orgId).maybeSingle(),
    client.from("netsuite_accounts").select("account_id").eq("org_id", orgId).maybeSingle(),
    client.from("salesforce_orgs").select("sf_org_id").eq("org_id", orgId).maybeSingle(),
    client.from("hubspot_accounts").select("hub_id").eq("org_id", orgId).maybeSingle(),
    client.from("slack_installations").select("team_id, team_name").eq("org_id", orgId).maybeSingle(),
    client.from("integration_accounts").select("provider, status, config_json, last_success_at, last_error_message").eq("org_id", orgId).in("provider", ["postgres_readonly", "mysql_readonly", "snowflake", "bigquery"]),
  ]);

  const connByProvider = new Map(
    (allConns ?? []).map((c) => [
      (c as { provider: string }).provider,
      c as { status?: string; config?: unknown; health_status?: string; last_success_at?: string; last_error?: string },
    ])
  );

  const jc = connByProvider.get("jira") ?? null;
  const gi = githubInst as { github_account_login?: string } | null;
  const na = netsuiteAccount as { account_id?: string } | null;
  const so = salesforceOrg as { sf_org_id?: string } | null;
  const ha = hubspotAccount as { hub_id?: number } | null;
  const si = slackInstall as { team_name?: string } | null;

  const jiraMeta = jc ? { config: jc.config, health_status: jc.health_status, last_success_at: jc.last_success_at } : undefined;
  const githubConn = connByProvider.get("github");
  const slackConn = connByProvider.get("slack");
  const sfConn = connByProvider.get("salesforce");
  const hsConn = connByProvider.get("hubspot");
  const nsConn = connByProvider.get("netsuite");

  const stripeConn = connByProvider.get("stripe") ?? null;
  const csvConn = connByProvider.get("csv") ?? null;

  const dbAccountByProvider = new Map(
    (dbAccounts ?? []).map((a) => [
      (a as { provider: string }).provider,
      a as { status?: string; config_json?: Record<string, unknown>; last_success_at?: string; last_error_message?: string },
    ])
  );
  const pgAcc = dbAccountByProvider.get("postgres_readonly");
  const mysqlAcc = dbAccountByProvider.get("mysql_readonly");
  const sfAcc = dbAccountByProvider.get("snowflake");
  const bqAcc = dbAccountByProvider.get("bigquery");

  return {
    jira: { provider: "jira", connected: jc?.status === "connected", meta: jiraMeta },
    github: { provider: "github", connected: !!githubInst, meta: { accountLogin: gi?.github_account_login, health_status: githubConn?.health_status, last_success_at: githubConn?.last_success_at } },
    netsuite: { provider: "netsuite", connected: !!netsuiteAccount, meta: { accountId: na?.account_id, health_status: nsConn?.health_status, last_success_at: nsConn?.last_success_at } },
    salesforce: { provider: "salesforce", connected: !!salesforceOrg, meta: { sfOrgId: so?.sf_org_id, health_status: sfConn?.health_status, last_success_at: sfConn?.last_success_at } },
    hubspot: { provider: "hubspot", connected: !!hubspotAccount, meta: { hubId: ha?.hub_id, health_status: hsConn?.health_status, last_success_at: hsConn?.last_success_at } },
    slack: { provider: "slack", connected: Boolean(si ?? slackInstall), meta: { teamName: si?.team_name, health_status: slackConn?.health_status, last_success_at: slackConn?.last_success_at } },
    stripe: { provider: "stripe", connected: stripeConn?.status === "connected", meta: stripeConn ? { health_status: stripeConn.health_status, last_success_at: stripeConn.last_success_at } : undefined },
    csv: { provider: "csv", connected: csvConn?.status === "connected", meta: csvConn ? { health_status: csvConn.health_status } : undefined },
    postgres_readonly: { provider: "postgres_readonly", connected: pgAcc?.status === "connected", meta: pgAcc ? { last_success_at: pgAcc.last_success_at, config: pgAcc.config_json } : undefined },
    mysql_readonly: { provider: "mysql_readonly", connected: mysqlAcc?.status === "connected", meta: mysqlAcc ? { last_success_at: mysqlAcc.last_success_at, config: mysqlAcc.config_json } : undefined },
    snowflake: { provider: "snowflake", connected: sfAcc?.status === "connected", meta: sfAcc ? { last_success_at: sfAcc.last_success_at, config: sfAcc.config_json } : undefined },
    bigquery: { provider: "bigquery", connected: bqAcc?.status === "connected", meta: bqAcc ? { last_success_at: bqAcc.last_success_at, config: bqAcc.config_json } : undefined },
  };
}
