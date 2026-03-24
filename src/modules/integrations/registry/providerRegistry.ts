/**
 * Phase 1 — Connector registry: maps provider to manifest and runtime.
 * §20.2 Registry.
 */

import type { ConnectorManifest } from "../contracts";
import type { ConnectorRuntime } from "../contracts/runtime";
import type { IntegrationProvider } from "../contracts/types";
import { getHubSpotManifest } from "../providers/hubspot/manifest";
import { getHubSpotRuntime } from "../providers/hubspot/runtime";
import { getSalesforceManifest } from "../providers/salesforce/manifest";
import { getSalesforceRuntime } from "../providers/salesforce/runtime";
import { getStripeManifest } from "../providers/stripe/manifest";
import { getStripeRuntime } from "../providers/stripe/runtime";
import { getSlackManifest } from "../providers/slack/manifest";
import { getSlackRuntime } from "../providers/slack/runtime";
import { getJiraManifest } from "../providers/jira/manifest";
import { getJiraRuntime } from "../providers/jira/runtime";
import { getGitHubManifest } from "../providers/github/manifest";
import { getGitHubRuntime } from "../providers/github/runtime";
import { getNetSuiteManifest } from "../providers/netsuite/manifest";
import { getNetSuiteRuntime } from "../providers/netsuite/runtime";
import { getCsvManifest } from "../providers/csv/manifest";
import { getCsvRuntime } from "../providers/csv/runtime";
import { getPostgresReadonlyManifest } from "../providers/postgres-readonly/manifest";
import { getPostgresReadonlyRuntime } from "../providers/postgres-readonly/runtime";
import { getMysqlReadonlyManifest } from "../providers/mysql-readonly/manifest";
import { getMysqlReadonlyRuntime } from "../providers/mysql-readonly/runtime";
import { getSnowflakeManifest } from "../providers/snowflake/manifest";
import { getSnowflakeRuntime } from "../providers/snowflake/runtime";
import { getBigQueryManifest } from "../providers/bigquery/manifest";
import { getBigQueryRuntime } from "../providers/bigquery/runtime";

type ManifestGetter = () => ConnectorManifest;
type RuntimeGetter = () => ConnectorRuntime;

const MANIFESTS: Record<IntegrationProvider, ManifestGetter> = {
  hubspot: getHubSpotManifest,
  salesforce: getSalesforceManifest,
  stripe: getStripeManifest,
  slack: getSlackManifest,
  jira: getJiraManifest,
  github: getGitHubManifest,
  netsuite: getNetSuiteManifest,
  csv: getCsvManifest,
  postgres_readonly: getPostgresReadonlyManifest,
  mysql_readonly: getMysqlReadonlyManifest,
  snowflake: getSnowflakeManifest,
  bigquery: getBigQueryManifest,
};

const RUNTIMES: Record<IntegrationProvider, RuntimeGetter> = {
  hubspot: getHubSpotRuntime,
  salesforce: getSalesforceRuntime,
  stripe: getStripeRuntime,
  slack: getSlackRuntime,
  jira: getJiraRuntime,
  github: getGitHubRuntime,
  netsuite: getNetSuiteRuntime,
  csv: getCsvRuntime,
  postgres_readonly: getPostgresReadonlyRuntime,
  mysql_readonly: getMysqlReadonlyRuntime,
  snowflake: getSnowflakeRuntime,
  bigquery: getBigQueryRuntime,
};

export const INTEGRATION_PROVIDERS_PHASE1: IntegrationProvider[] = [
  "hubspot",
  "salesforce",
  "stripe",
  "slack",
  "jira",
  "github",
  "netsuite",
];

export const INTEGRATION_PROVIDERS_PHASE3: IntegrationProvider[] = [
  "csv",
  "postgres_readonly",
  "mysql_readonly",
  "snowflake",
  "bigquery",
];

export function getRegistryManifest(provider: IntegrationProvider): ConnectorManifest {
  const fn = MANIFESTS[provider];
  if (!fn) throw new Error(`Unknown provider: ${provider}`);
  return fn();
}

export function getRegistryRuntime(provider: IntegrationProvider): ConnectorRuntime {
  const fn = RUNTIMES[provider];
  if (!fn) throw new Error(`Unknown provider: ${provider}`);
  return fn();
}

export function hasProvider(provider: string): provider is IntegrationProvider {
  return Object.prototype.hasOwnProperty.call(MANIFESTS, provider);
}
