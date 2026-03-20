/**
 * Gap 4 — Retry orchestration (§9).
 * Attempt delays: 0, 30s, 2m, 10m, 30m
 */
export const RETRY_DELAYS_MS = [0, 30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];

export const DEFAULT_MAX_ATTEMPTS = 5;

export function getRetryDelayMs(attemptIndex: number): number {
  if (attemptIndex < 0) return RETRY_DELAYS_MS[0];
  if (attemptIndex >= RETRY_DELAYS_MS.length) {
    return RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  }
  return RETRY_DELAYS_MS[attemptIndex];
}

export function getNextRetryAt(attemptCount: number): Date {
  const delayMs = getRetryDelayMs(attemptCount);
  return new Date(Date.now() + delayMs);
}

export function shouldRetry(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount < maxAttempts;
}
