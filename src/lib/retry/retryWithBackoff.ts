/**
 * Phase 5 — unified retry helper. `retries` = total attempts; `backoff.length` must be `retries - 1`.
 */
export type RetryWithBackoffConfig = {
  retries: number;
  backoffMs: number[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, config: RetryWithBackoffConfig): Promise<T> {
  const { retries, backoffMs } = config;
  if (retries < 1) throw new Error("retries must be >= 1");
  if (backoffMs.length !== retries - 1) {
    throw new Error(`backoffMs length must be retries - 1 (got ${backoffMs.length}, expected ${retries - 1})`);
  }
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === retries - 1) break;
      await sleep(backoffMs[i] ?? 0);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const RETRY_PRESETS = {
  /** 3 attempts → 2 backoff sleeps */
  integrationSync: { retries: 3, backoffMs: [1000, 5000] },
  oauthRefresh: { retries: 2, backoffMs: [1000, 5000] },
  detectionRunner: { retries: 2, backoffMs: [1000, 5000] },
  verificationRunner: { retries: 2, backoffMs: [1000, 5000] },
  /** 6 attempts → 5 backoff sleeps (1s → … → 1h) */
  slackOrEmail: { retries: 6, backoffMs: [1000, 5000, 30000, 300_000, 3_600_000] },
} as const satisfies Record<string, RetryWithBackoffConfig>;
