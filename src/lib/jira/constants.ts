/**
 * Canonical Jira OAuth scope definition.
 * All Jira OAuth routes must import this — no duplicated scope strings.
 * @see Phase 3 — Jira Production Hardening
 */
export const JIRA_OAUTH_SCOPES = [
  "read:jira-work",
  "write:jira-work",
  "read:jira-user",
  "read:project:jira",
  "manage:jira-webhook",
  "offline_access",
] as const;

export const JIRA_OAUTH_SCOPE_STRING = JIRA_OAUTH_SCOPES.join(" ");
