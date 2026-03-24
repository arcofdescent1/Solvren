/**
 * Phase 3 — Resolve next run time from cron expression.
 */
export function getNextRunAt(cronExpression: string, fromDate: Date = new Date(), timezone = "UTC"): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) {
    return new Date(fromDate.getTime() + 60 * 60 * 1000); // default 1h
  }
  const [min, hour, dayOfMonth, month, dayOfWeek] = parts;
  const next = new Date(fromDate);

  if (min !== "*") {
    const m = parseInt(min, 10);
    if (!isNaN(m)) {
      next.setMinutes(m, 0, 0);
      if (next <= fromDate) next.setHours(next.getHours() + 1);
      return next;
    }
  }
  if (hour !== "*") {
    const h = parseInt(hour, 10);
    if (!isNaN(h)) {
      next.setHours(h, next.getMinutes(), 0, 0);
      if (next <= fromDate) next.setDate(next.getDate() + 1);
      return next;
    }
  }

  // Simple presets
  const preset = cronExpression.toLowerCase();
  if (preset === "*/15 * * * *" || preset === "every 15 min") {
    next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);
    if (next <= fromDate) next.setMinutes(next.getMinutes() + 15);
    return next;
  }
  if (preset === "0 * * * *" || preset === "hourly") {
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  }
  if (preset === "0 0 * * *" || preset === "daily") {
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + 1);
    return next;
  }

  return new Date(fromDate.getTime() + 60 * 60 * 1000);
}

export const CRON_PRESETS = {
  every15min: "*/15 * * * *",
  hourly: "0 * * * *",
  daily: "0 0 * * *",
  weekly: "0 0 * * 0",
} as const;
