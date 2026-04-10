/**
 * Phase 6 — rolling approval duration baseline (trim top/bottom 5%, median).
 * Use with historical approval rows when wiring APPROVAL_TIME_SAVED detection.
 */
export function trimmedMedianHours(durationsHours: number[], trimFraction = 0.05): number | null {
  const v = durationsHours.filter((x) => Number.isFinite(x) && x >= 0);
  if (v.length === 0) return null;
  const sorted = [...v].sort((a, b) => a - b);
  const k = Math.max(0, Math.floor(sorted.length * trimFraction));
  const slice = k > 0 ? sorted.slice(k, sorted.length - k) : sorted;
  if (slice.length === 0) return null;
  const mid = Math.floor(slice.length / 2);
  if (slice.length % 2 === 1) return slice[mid]!;
  return (slice[mid - 1]! + slice[mid]!) / 2;
}
