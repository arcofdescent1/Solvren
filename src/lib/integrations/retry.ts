/**
 * Shared retry constants and helpers for integration event failures.
 */

/** Delay schedule in ms: 1m, 5m, 15m, 1h, 6h */
export const RETRY_DELAYS_MS = [60e3, 5 * 60e3, 15 * 60e3, 60 * 60e3, 6 * 60 * 60e3] as const;

export const DEFAULT_MAX_ATTEMPTS = 5;
export const RETRY_JITTER = 0.2;

/**
 * Compute next_retry_at timestamp for a given attempt count.
 */
export function nextRetryAt(attemptCount: number): string {
  const idx = Math.min(attemptCount, RETRY_DELAYS_MS.length - 1);
  const base = RETRY_DELAYS_MS[idx];
  const jitter = base * RETRY_JITTER * (Math.random() * 2 - 1);
  return new Date(Date.now() + base + jitter).toISOString();
}
