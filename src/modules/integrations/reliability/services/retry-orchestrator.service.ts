/**
 * Phase 4 — Retry orchestrator (§13).
 */
export const DEFAULT_RETRY_SCHEDULE_MS = [0, 2000, 10000, 60000];

export function getRetryDelayMs(attemptIndex: number): number {
  if (attemptIndex < 0 || attemptIndex >= DEFAULT_RETRY_SCHEDULE_MS.length) {
    return DEFAULT_RETRY_SCHEDULE_MS[DEFAULT_RETRY_SCHEDULE_MS.length - 1];
  }
  return DEFAULT_RETRY_SCHEDULE_MS[attemptIndex];
}

export function shouldRetry(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount < maxAttempts;
}
