export function calendarQuarterBounds(ref: Date): { start: Date; end: Date } {
  const cq = Math.floor(ref.getUTCMonth() / 3);
  const start = new Date(Date.UTC(ref.getUTCFullYear(), cq * 3, 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), cq * 3 + 3, 0, 23, 59, 59, 999));
  return { start, end };
}
