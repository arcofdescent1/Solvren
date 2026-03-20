/**
 * Phase 8 — Seed helpers for deterministic demo data.
 */

// Rolling reference: use "now" minus a few days so data looks recent
const NOW = Date.now();
export const ts = (daysOffset: number, hoursOffset = 0) =>
  new Date(NOW + daysOffset * 24 * 60 * 60 * 1000 + hoursOffset * 60 * 60 * 1000).toISOString();

// Deterministic UUID v4-ish from seed string (for stable references across resets)
export function seededUuid(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const h = (n: number) => {
    const v = Math.abs((hash * (n + 1) * 31) % 0xffffffff);
    return v.toString(16).padStart(8, "0").slice(-8);
  };
  return `${h(1)}-${h(2).slice(0, 4)}-4${h(3).slice(1, 4)}-8${h(4).slice(1, 4)}-${h(5)}${h(6)}`;
}
