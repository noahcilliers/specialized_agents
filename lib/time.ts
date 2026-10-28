/** Time-zone helpers that work with plain Intl (no date library needed). */

export function isValidTimeZone(tz: string | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function serverTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Offset of `tz` from UTC at the given instant, in milliseconds. */
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `tz` to a UTC Date. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = tzOffsetMs(new Date(guess), tz);
  let utc = guess - first;
  const second = tzOffsetMs(new Date(utc), tz);
  if (second !== first) utc = guess - second; // DST boundary
  return new Date(utc);
}

/**
 * Turn whatever the model passed ("2026-10-28", "2026-10-28T09:00", or a full
 * RFC 3339 timestamp) into an RFC 3339 UTC timestamp. Date-only and offset-less
 * values are read as local time in `tz`.
 */
export function toRfc3339(value: string, tz: string): string | null {
  const trimmed = value.trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const date = zonedToUtc(+y, +mo, +d, +h, +mi, +s, tz);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Today's calendar date in `tz` as "YYYY-MM-DD". */
export function localDate(tz: string, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6 */
function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function dayLabel(date: string): string {
  return `${WEEKDAYS[weekdayIndex(date)]} ${date}`;
}

/**
 * Resolve a single day: "today", "tomorrow", a weekday name (its next
 * occurrence, counting today) or a YYYY-MM-DD date.
 */
export function resolveDay(value: string, tz: string, now = new Date()): string | null {
  const v = value.trim().toLowerCase();
  const today = localDate(tz, now);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (v === "today") return today;
  if (v === "tomorrow") return addDays(today, 1);
  const target = WEEKDAYS.findIndex((d) => v.replace(/^next\s+/, "").startsWith(d.slice(0, 3).toLowerCase()));
  if (target === -1) return null;
  const ahead = (target - weekdayIndex(today) + 7) % 7;
  return addDays(today, v.startsWith("next ") && ahead === 0 ? 7 : ahead);
}

/** "9:30 AM" in the given time zone. */
export function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date);
}

export const NAMED_RANGES = ["today", "tomorrow", "this_week", "next_week", "next_7_days", "this_month"] as const;
export type NamedRange = (typeof NAMED_RANGES)[number];

/** Turn a named range into [start, end) dates in the user's time zone. Weeks start on Monday. */
export function resolveRange(range: NamedRange, tz: string, now = new Date()): { start: string; end: string } {
  const today = localDate(tz, now);
  const monday = addDays(today, -weekdayIndex(today));
  switch (range) {
    case "today":
      return { start: today, end: addDays(today, 1) };
    case "tomorrow":
      return { start: addDays(today, 1), end: addDays(today, 2) };
    case "this_week":
      return { start: monday, end: addDays(monday, 7) };
    case "next_week":
      return { start: addDays(monday, 7), end: addDays(monday, 14) };
    case "next_7_days":
      return { start: today, end: addDays(today, 7) };
    case "this_month": {
      const [y, m] = today.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return { start: `${today.slice(0, 8)}01`, end: next };
    }
  }
}

/**
 * A short block of context prepended to each user message. Spelling out today's
 * and tomorrow's dates helps small local models, which are weak at date math.
 */
export function contextBlock(tz: string, now = new Date()): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(now);
  const today = localDate(tz, now);
  const offsetMin = Math.round(tzOffsetMs(now, tz) / 60_000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const offset = `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  const coming = [2, 3, 4, 5, 6, 7].map((n) => dayLabel(addDays(today, n))).join(", ");
  return [
    "<context>",
    `Today: ${dayLabel(today)}, current time ${time}`,
    `Tomorrow: ${dayLabel(addDays(today, 1))}`,
    `Coming days: ${coming}`,
    `Time zone: ${tz} (${offset})`,
    "</context>",
  ].join("\n");
}

export const CONTEXT_PREFIX = "<context>";
export const CONTEXT_SUFFIX = "</context>";

/** Remove the context block from a stored user message. */
export function stripContext(text: string): string {
  if (!text.startsWith(CONTEXT_PREFIX)) return text;
  const end = text.indexOf(CONTEXT_SUFFIX);
  return end === -1 ? text : text.slice(end + CONTEXT_SUFFIX.length).trimStart();
}
