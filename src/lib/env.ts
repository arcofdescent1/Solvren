/**
 * Centralized env access and validation.
 * Use this from server-side code only. Never export secrets to client.
 * Client-safe vars are NEXT_PUBLIC_* and must be read via process.env in client code.
 *
 * Required vars are validated lazily (on first access) so `next build` can run
 * without a full .env; at runtime the first use of a missing required var will throw.
 *
 * Integration flags (aiEnabled, billingEnabled, etc.) indicate whether optional
 * integrations are configured. Missing keys = feature disabled. Never use placeholders.
 */

function required(name: string, value: string | undefined): string {
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  return value;
}

function lazyRequired(name: string, getValue: () => string | undefined): string {
  const v = getValue();
  return required(name, v);
}

export const env = {
  /** App base URL (canonical; use instead of APP_BASE_URL or NEXT_PUBLIC_APP_URL). */
  get appUrl(): string {
    return lazyRequired("APP_URL", () => process.env.APP_URL);
  },

  /** Supabase (required for app to function). */
  get supabaseUrl(): string {
    return lazyRequired("NEXT_PUBLIC_SUPABASE_URL", () => process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey(): string {
    return lazyRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY", () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get supabaseServiceRoleKey(): string {
    return lazyRequired("SUPABASE_SERVICE_ROLE_KEY", () => process.env.SUPABASE_SERVICE_ROLE_KEY);
  },

  /** Stripe (optional unless billing is enabled). */
  get stripeSecretKey(): string | undefined {
    return optional(process.env.STRIPE_SECRET_KEY);
  },
  get stripeWebhookSecret(): string | undefined {
    return optional(process.env.STRIPE_WEBHOOK_SECRET);
  },
  get stripePriceTeam(): string | undefined {
    return optional(process.env.STRIPE_PRICE_TEAM);
  },
  get stripePriceBusiness(): string | undefined {
    return optional(process.env.STRIPE_PRICE_BUSINESS);
  },

  /** Slack (optional unless Slack integration is enabled). */
  get slackClientId(): string | undefined {
    return optional(process.env.SLACK_CLIENT_ID);
  },
  get slackClientSecret(): string | undefined {
    return optional(process.env.SLACK_CLIENT_SECRET);
  },
  get slackSigningSecret(): string | undefined {
    return optional(process.env.SLACK_SIGNING_SECRET);
  },
  get slackBotToken(): string | undefined {
    return optional(process.env.SLACK_BOT_TOKEN);
  },
  get slackRedirectUri(): string | undefined {
    return optional(process.env.SLACK_REDIRECT_URI);
  },
  get slackStateSecret(): string | undefined {
    return optional(process.env.SLACK_STATE_SECRET);
  },

  /** Cron (optional; required when calling cron routes). */
  get cronSecret(): string | undefined {
    return optional(process.env.CRON_SECRET);
  },

  /** OpenAI (optional). */
  get openaiApiKey(): string | undefined {
    return optional(process.env.OPENAI_API_KEY);
  },
  /** AI daily request limit (optional). When set, AI routes return 429 when today's count exceeds this. */
  get aiDailyRequestLimit(): number | undefined {
    const v = optional(process.env.AI_DAILY_REQUEST_LIMIT);
    if (v == null) return undefined;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  },

  /** Resend / email (optional). */
  get resendApiKey(): string | undefined {
    return optional(process.env.RESEND_API_KEY);
  },
  /** Sender address for transactional email. Canonical name; RESEND_FROM is legacy. */
  get emailFrom(): string | undefined {
    return optional(process.env.EMAIL_FROM ?? process.env.RESEND_FROM);
  },

  /** Sentry (optional). */
  get sentryDsn(): string | undefined {
    return optional(process.env.SENTRY_DSN);
  },
  get nextPublicSentryDsn(): string | undefined {
    return optional(process.env.NEXT_PUBLIC_SENTRY_DSN);
  },
  get sentryAuthToken(): string | undefined {
    return optional(process.env.SENTRY_AUTH_TOKEN);
  },

  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },

  /** Integration flags: true only when all required keys for that integration are present. */
  get aiEnabled(): boolean {
    const key = optional(process.env.OPENAI_API_KEY);
    return typeof key === "string" && key.length > 0 && !key.startsWith("sk-placeholder");
  },

  get billingEnabled(): boolean {
    return !!(
      optional(process.env.STRIPE_SECRET_KEY) &&
      optional(process.env.STRIPE_WEBHOOK_SECRET) &&
      optional(process.env.STRIPE_PRICE_TEAM) &&
      optional(process.env.STRIPE_PRICE_BUSINESS)
    );
  },

  get slackEnabled(): boolean {
    if (process.env.SLACK_INTEGRATION_ENABLED === "false") return false;
    return !!(
      optional(process.env.SLACK_CLIENT_ID) &&
      optional(process.env.SLACK_CLIENT_SECRET) &&
      optional(process.env.SLACK_SIGNING_SECRET)
    );
  },

  get emailEnabled(): boolean {
    return !!(optional(process.env.RESEND_API_KEY) && optional(process.env.EMAIL_FROM ?? process.env.RESEND_FROM));
  },

  /** Jira / Atlassian Cloud integration (optional). ATLASSIAN_* takes precedence over JIRA_*. */
  get jiraClientId(): string | undefined {
    return optional(process.env.ATLASSIAN_CLIENT_ID ?? process.env.JIRA_CLIENT_ID);
  },
  get jiraClientSecret(): string | undefined {
    return optional(process.env.ATLASSIAN_CLIENT_SECRET ?? process.env.JIRA_CLIENT_SECRET);
  },
  get jiraRedirectUri(): string | undefined {
    return optional(process.env.ATLASSIAN_REDIRECT_URI ?? process.env.JIRA_REDIRECT_URI);
  },
  get jiraStateSecret(): string | undefined {
    return optional(
      process.env.ATLASSIAN_STATE_SECRET ??
        process.env.JIRA_STATE_SECRET ??
        process.env.SLACK_STATE_SECRET
    );
  },

  get ssoEnabled(): boolean {
    return process.env.SSO_ENABLED !== "false";
  },
  /** Comma-separated emails allowed to use local login when org enforces SSO (break-glass). */
  get ssoBreakGlassEmails(): string[] {
    const v = optional(process.env.SSO_BREAK_GLASS_EMAILS);
    if (!v) return [];
    return v.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  },

  get jiraEnabled(): boolean {
    if (process.env.JIRA_INTEGRATION_ENABLED === "false") return false;
    return !!(
      optional(process.env.ATLASSIAN_CLIENT_ID ?? process.env.JIRA_CLIENT_ID) &&
      optional(process.env.ATLASSIAN_CLIENT_SECRET ?? process.env.JIRA_CLIENT_SECRET)
    );
  },

  /** GitHub App integration (optional). */
  get githubAppId(): string | undefined {
    return optional(process.env.GITHUB_APP_ID);
  },
  get githubClientId(): string | undefined {
    return optional(process.env.GITHUB_CLIENT_ID);
  },
  get githubClientSecret(): string | undefined {
    return optional(process.env.GITHUB_CLIENT_SECRET);
  },
  get githubWebhookSecret(): string | undefined {
    return optional(process.env.GITHUB_WEBHOOK_SECRET);
  },
  get githubPrivateKeyBase64(): string | undefined {
    return optional(process.env.GITHUB_PRIVATE_KEY_BASE64);
  },
  get githubApiBaseUrl(): string {
    return optional(process.env.GITHUB_API_BASE_URL) ?? "https://api.github.com";
  },
  get githubAppName(): string | undefined {
    return optional(process.env.GITHUB_APP_NAME);
  },
  get githubDefaultStatusContext(): string {
    return optional(process.env.GITHUB_DEFAULT_STATUS_CONTEXT) ?? "Solvren / governance";
  },
  get githubConnectTimeoutMs(): number {
    const v = optional(process.env.GITHUB_CONNECT_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 5000;
  },
  get githubReadTimeoutMs(): number {
    const v = optional(process.env.GITHUB_READ_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 10000;
  },
  get githubMaxRetries(): number {
    const v = optional(process.env.GITHUB_MAX_RETRIES);
    return v ? parseInt(v, 10) : 5;
  },
  /** NetSuite integration (optional). */
  get netsuiteIntegrationEnabled(): boolean {
    return process.env.NETSUITE_INTEGRATION_ENABLED !== "false";
  },
  get netsuiteApiBaseUrlTemplate(): string {
    return optional(process.env.NETSUITE_API_BASE_URL_TEMPLATE) ?? "https://{accountId}.suitetalk.api.netsuite.com";
  },
  get netsuiteTokenUrlTemplate(): string {
    return optional(process.env.NETSUITE_TOKEN_URL_TEMPLATE) ?? "https://{accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token";
  },
  get netsuiteConnectTimeoutMs(): number {
    const v = optional(process.env.NETSUITE_CONNECT_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 5000;
  },
  get netsuiteReadTimeoutMs(): number {
    const v = optional(process.env.NETSUITE_READ_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 15000;
  },
  get netsuiteMaxRetries(): number {
    const v = optional(process.env.NETSUITE_MAX_RETRIES);
    return v ? parseInt(v, 10) : 5;
  },
  get netsuiteDefaultQueryPageSize(): number {
    const v = optional(process.env.NETSUITE_DEFAULT_QUERY_PAGE_SIZE);
    return v ? parseInt(v, 10) : 1000;
  },
  get netsuiteValidationJobTimeoutMs(): number {
    const v = optional(process.env.NETSUITE_VALIDATION_JOB_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 120000;
  },

  /** Salesforce integration (optional). */
  get salesforceIntegrationEnabled(): boolean {
    return process.env.SALESFORCE_INTEGRATION_ENABLED !== "false";
  },
  get salesforceApiVersion(): string {
    return optional(process.env.SALESFORCE_API_VERSION) ?? "v61.0";
  },
  get salesforceLoginUrl(): string {
    return optional(process.env.SALESFORCE_LOGIN_URL) ?? "https://login.salesforce.com";
  },
  get salesforceTestLoginUrl(): string {
    return optional(process.env.SALESFORCE_TEST_LOGIN_URL) ?? "https://test.salesforce.com";
  },
  get salesforceConnectTimeoutMs(): number {
    const v = optional(process.env.SALESFORCE_CONNECT_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 5000;
  },
  get salesforceReadTimeoutMs(): number {
    const v = optional(process.env.SALESFORCE_READ_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 15000;
  },
  get salesforceMaxRetries(): number {
    const v = optional(process.env.SALESFORCE_MAX_RETRIES);
    return v ? parseInt(v, 10) : 5;
  },
  get salesforcePubsubEnabled(): boolean {
    return process.env.SALESFORCE_PUBSUB_ENABLED !== "false";
  },
  get salesforceDefaultBatchSize(): number {
    const v = optional(process.env.SALESFORCE_DEFAULT_BATCH_SIZE);
    return v ? parseInt(v, 10) : 200;
  },
  get salesforceDefaultCompositeLimit(): number {
    const v = optional(process.env.SALESFORCE_DEFAULT_COMPOSITE_LIMIT);
    return v ? parseInt(v, 10) : 25;
  },

  /** HubSpot integration (optional). */
  get hubspotIntegrationEnabled(): boolean {
    return process.env.HUBSPOT_INTEGRATION_ENABLED !== "false";
  },
  get hubspotApiBaseUrl(): string {
    return optional(process.env.HUBSPOT_API_BASE_URL) ?? "https://api.hubapi.com";
  },
  get hubspotOAuthAuthorizeUrl(): string {
    return optional(process.env.HUBSPOT_OAUTH_AUTHORIZE_URL) ?? "https://app.hubspot.com/oauth/authorize";
  },
  get hubspotOAuthTokenUrl(): string {
    return optional(process.env.HUBSPOT_OAUTH_TOKEN_URL) ?? "https://api.hubapi.com/oauth/v1/token";
  },
  get hubspotClientId(): string | undefined {
    return optional(process.env.HUBSPOT_CLIENT_ID);
  },
  get hubspotClientSecret(): string | undefined {
    return optional(process.env.HUBSPOT_CLIENT_SECRET);
  },
  get hubspotRedirectUri(): string | undefined {
    return optional(process.env.HUBSPOT_REDIRECT_URI);
  },
  get hubspotWebhookTargetUrl(): string | undefined {
    return optional(process.env.HUBSPOT_WEBHOOK_TARGET_URL);
  },
  get hubspotConnectTimeoutMs(): number {
    const v = optional(process.env.HUBSPOT_CONNECT_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 5000;
  },
  get hubspotReadTimeoutMs(): number {
    const v = optional(process.env.HUBSPOT_READ_TIMEOUT_MS);
    return v ? parseInt(v, 10) : 15000;
  },
  get hubspotMaxRetries(): number {
    const v = optional(process.env.HUBSPOT_MAX_RETRIES);
    return v ? parseInt(v, 10) : 5;
  },
  get hubspotDefaultBatchSize(): number {
    const v = optional(process.env.HUBSPOT_DEFAULT_BATCH_SIZE);
    return v ? parseInt(v, 10) : 100;
  },
  get hubspotWebhooksEnabled(): boolean {
    return process.env.HUBSPOT_WEBHOOKS_ENABLED !== "false";
  },
  get hubspotStateSecret(): string | undefined {
    return optional(process.env.HUBSPOT_STATE_SECRET ?? process.env.SLACK_STATE_SECRET);
  },

  get githubEnabled(): boolean {
    if (process.env.GITHUB_INTEGRATION_ENABLED === "false") return false;
    return !!(
      optional(process.env.GITHUB_APP_ID) &&
      optional(process.env.GITHUB_CLIENT_ID) &&
      optional(process.env.GITHUB_CLIENT_SECRET) &&
      optional(process.env.GITHUB_WEBHOOK_SECRET) &&
      optional(process.env.GITHUB_PRIVATE_KEY_BASE64)
    );
  },
};

/**
 * Validate required env vars at startup. Call from instrumentation.ts.
 * Throws if any required var is missing.
 */
export function validateRequiredEnv(): void {
  required("APP_URL", process.env.APP_URL);
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
