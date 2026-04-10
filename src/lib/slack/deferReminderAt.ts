/**
 * Phase 4: "Tomorrow morning" at 09:00 local, skipping weekends, in an IANA timezone.
 */

function partsInTz(d: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = dtf.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((x) => x.type === t)?.value ?? NaN);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    weekday: parts.find((x) => x.type === "weekday")?.value ?? "",
  };
}

function isWeekendWeekday(short: string): boolean {
  const u = short.slice(0, 3).toLowerCase();
  return u === "sat" || u === "sun";
}

function calendarDayKey(p: { year: number; month: number; day: number }) {
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * First instant after `now` that falls on a later calendar day (in TZ), weekday Mon–Fri, at 09:00–09:14 local.
 * (15-minute scan avoids DST edge false negatives.)
 */
export function nextTomorrowMorningNineAm(timeZone: string): Date {
  const tz = timeZone?.trim() || "UTC";
  const now = new Date();
  const todayKey = calendarDayKey(partsInTz(now, tz));

  for (let step = 1; step < 24 * 14 * 4; step++) {
    const probe = new Date(now.getTime() + step * 15 * 60 * 1000);
    const p = partsInTz(probe, tz);
    if (p.hour !== 9 || p.minute >= 15) continue;
    if (isWeekendWeekday(p.weekday)) continue;
    if (calendarDayKey(p) === todayKey) continue;
    return probe;
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
