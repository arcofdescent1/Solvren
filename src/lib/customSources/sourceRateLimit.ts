/** In-memory per-source rate limit (Phase 3 MVP). Resets per rolling minute bucket. */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function allowCustomSourceRequest(sourceId: string, perMinute: number): boolean {
  const now = Date.now();
  const b = buckets.get(sourceId);
  if (!b || now >= b.resetAt) {
    buckets.set(sourceId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (b.count >= perMinute) return false;
  b.count += 1;
  return true;
}
