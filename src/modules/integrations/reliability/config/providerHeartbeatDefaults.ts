/**
 * Phase 4 — Provider heartbeat configuration (§8.1).
 */
export type HeartbeatConfig = {
  enabled: boolean;
  staleAfterMinutes: number;
};

export const PROVIDER_HEARTBEAT_DEFAULTS: Record<string, HeartbeatConfig> = {
  stripe: { enabled: true, staleAfterMinutes: 1440 },
  hubspot: { enabled: true, staleAfterMinutes: 1440 },
  jira: { enabled: false, staleAfterMinutes: 1440 },
  slack: { enabled: false, staleAfterMinutes: 1440 },
};

export function getHeartbeatConfig(provider: string): HeartbeatConfig {
  return PROVIDER_HEARTBEAT_DEFAULTS[provider] ?? { enabled: false, staleAfterMinutes: 1440 };
}
