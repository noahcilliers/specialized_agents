import { z } from "zod";
import { defineTool, type PluginRuntime } from "../tool";
import { getAccessToken, NotConnectedError } from "./oauth";
import { addDays, dayLabel, formatTime, localDate, NAMED_RANGES, resolveDay, resolveRange, toRfc3339 } from "../../time";

const API = "https://www.googleapis.com/calendar/v3";

async function calendarGet<T>(pathname: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(API + pathname);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`Google Calendar API error (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }
  return (await res.json()) as T;
}

function notConnected(err: unknown) {
  if (err instanceof NotConnectedError) {
    return {
      error: "not_connected",
      message: `${err.message} The user can connect it on the Plugins page of this app.`,
    };
  }
  throw err;
}

/**
 * Local models often fill optional arguments with placeholders ("", null, or
 * even the string "<nil>"); treat those as absent.
 */
const PLACEHOLDERS = new Set(["", "<nil>", "nil", "null", "none", "undefined", "n/a"]);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (v === null || (typeof v === "string" && PLACEHOLDERS.has(v.trim().toLowerCase())) ? undefined : v),
    schema.optional(),
  );

// ---------- gcal_list_calendars ----------

interface CalendarListEntry {
  id: string;
  summary: string;
  summaryOverride?: string;
  primary?: boolean;
  accessRole: string;
  timeZone?: string;
  selected?: boolean;
}

const listCalendars = defineTool({
  name: "gcal_list_calendars",
  label: "Listed calendars",
  description:
    "List the calendars in the user's Google account (their own, shared and subscribed). Use it to find a calendar_id before reading events from a calendar other than the primary one.",
  inputSchema: { type: "object", properties: {} },
  schema: z.object({}).passthrough(),
  async run() {
    try {
      const data = await calendarGet<{ items?: CalendarListEntry[] }>("/users/me/calendarList", { maxResults: "250" });
      const calendars = (data.items ?? []).map((c) => ({
        id: c.id,
        name: c.summaryOverride ?? c.summary,
        primary: Boolean(c.primary),
        access: c.accessRole,
      }));
      return { count: calendars.length, calendars };
    } catch (err) {
      return notConnected(err);
    }
  },
  summarize(output) {
    const o = output as { count?: number; error?: string };
    if (o.error) return "Not connected";
    return `${o.count ?? 0} calendar${o.count === 1 ? "" : "s"}`;
  },
});

// ---------- gcal_list_events ----------

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  attendees?: { email?: string; displayName?: string; responseStatus?: string; self?: boolean }[];
  organizer?: { email?: string; displayName?: string; self?: boolean };
  hangoutLink?: string;
  recurringEventId?: string;
  eventType?: string;
}

const listEventsInput = z
  .object({
    day: optional(z.string().min(1)),
    range: optional(z.preprocess((v) => (typeof v === "string" ? v.toLowerCase().trim() : v), z.enum(NAMED_RANGES))),
    start: optional(z.string().min(1)),
    end: optional(z.string().min(1)),
    calendar_id: optional(z.string().min(1)),
    query: optional(z.string().min(1)),
    max_results: optional(z.coerce.number().int().min(1).max(250)),
  })
  .refine((v) => v.day || v.range || (v.start && v.end), "Pass day, range, or both start and end.");

const MAX_DESCRIPTION = 200;
const MAX_ATTENDEES = 8;
const MAX_DAYS = 31;
/** Free time is reported inside this window each day. */
const DAY_WINDOW = { start: "08:00", end: "20:00", label: "8 AM to 8 PM" };
const MIN_FREE_MINUTES = 30;

interface TimedEvent {
  title: string;
  start: Date;
  end: Date;
}

/** Pre-compute what small models get wrong: free time and overlaps, per day. */
function digestDays(fromDate: string, toDate: string, timed: TimedEvent[], tz: string) {
  const days: { date: string; busy: TimedEvent[] }[] = [];
  for (let d = fromDate; d < toDate && days.length < MAX_DAYS; d = addDays(d, 1)) days.push({ date: d, busy: [] });

  const conflicts: string[] = [];
  const sorted = [...timed].sort((a, b) => a.start.getTime() - b.start.getTime());
  const span = (e: TimedEvent) => `${formatTime(e.start, tz)}–${formatTime(e.end, tz)}`;
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j++) {
      const a = sorted[i];
      const b = sorted[j];
      conflicts.push(`${dayLabel(localDate(tz, a.start))}: "${a.title}" (${span(a)}) overlaps "${b.title}" (${span(b)})`);
    }
  }

  return {
    conflicts,
    free: days.map(({ date }) => {
      const windowStart = new Date(toRfc3339(`${date}T${DAY_WINDOW.start}`, tz)!);
      const windowEnd = new Date(toRfc3339(`${date}T${DAY_WINDOW.end}`, tz)!);
      const busy = sorted
        .filter((e) => e.start < windowEnd && e.end > windowStart)
        .map((e) => ({ start: Math.max(e.start.getTime(), windowStart.getTime()), end: Math.min(e.end.getTime(), windowEnd.getTime()) }));
      const blocks: string[] = [];
      let cursor = windowStart.getTime();
      for (const b of busy) {
        if (b.start - cursor >= MIN_FREE_MINUTES * 60_000) {
          blocks.push(`${formatTime(new Date(cursor), tz)}–${formatTime(new Date(b.start), tz)}`);
        }
        cursor = Math.max(cursor, b.end);
      }
      if (windowEnd.getTime() - cursor >= MIN_FREE_MINUTES * 60_000) {
        blocks.push(`${formatTime(new Date(cursor), tz)}–${formatTime(windowEnd, tz)}`);
      }
      return { date, free_blocks: blocks };
    }),
  };
}

const listEvents = defineTool({
  name: "gcal_list_events",
  label: "Checked Google Calendar",
  description:
    "Read the user's Google Calendar. Results are grouped by day and already include each day's free time and any overlapping events, so report those instead of working them out yourself. " +
    "For one day pass `day` (today, tomorrow, a weekday name like friday, or a date like 2026-10-28). " +
    "For a period pass `range` (today, tomorrow, this_week, next_week, next_7_days, this_month). " +
    "Otherwise pass `start` and `end` dates (end is exclusive).",
  inputSchema: {
    type: "object",
    properties: {
      day: { type: "string", description: "A single day: today, tomorrow, a weekday name (e.g. friday) or a date (2026-10-28)." },
      range: {
        type: "string",
        enum: [...NAMED_RANGES],
        description: "A named period in the user's time zone. Weeks run Monday to Sunday.",
      },
      start: { type: "string", description: "Start date, e.g. 2026-10-28. Use with end." },
      end: { type: "string", description: "End date (exclusive), e.g. 2026-10-29. Use with start." },
      calendar_id: { type: "string", description: "Calendar to read. Leave out for the primary calendar." },
      query: { type: "string", description: "Optional keyword to filter events, e.g. 'dentist'." },
      max_results: { type: "integer", description: "Maximum events to return (default 100)." },
    },
  },
  schema: listEventsInput,
  describe(input) {
    const span = input.day ?? (input.range ? input.range.replace(/_/g, " ") : `${input.start} → ${input.end}`);
    return input.query ? `${span} · “${input.query}”` : span;
  },
  async run(input, ctx) {
    const tz = ctx.timeZone;
    let span: { start: string; end: string };
    if (input.day) {
      const date = resolveDay(input.day, tz);
      if (!date) return { error: "invalid_day", message: `Couldn't understand day "${input.day}". Use a weekday name or a date like 2026-10-28.` };
      span = { start: date, end: addDays(date, 1) };
    } else if (input.range) {
      span = resolveRange(input.range, tz);
    } else {
      span = { start: input.start!, end: input.end! };
    }
    const timeMin = toRfc3339(span.start, tz);
    const timeMax = toRfc3339(span.end, tz);
    if (!timeMin || !timeMax) {
      return { error: "invalid_time", message: "start and end must be dates like 2026-10-28." };
    }
    if (timeMax <= timeMin) {
      return { error: "invalid_range", message: "end must be after start." };
    }
    try {
      const calendarId = input.calendar_id ?? "primary";
      const data = await calendarGet<{ items?: GoogleEvent[]; summary?: string; nextPageToken?: string }>(
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          timeMin,
          timeMax,
          q: input.query,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: String(input.max_results ?? 100),
          timeZone: tz,
        },
      );
      const items = (data.items ?? []).filter((e) => e.status !== "cancelled");
      const timed: TimedEvent[] = [];
      const byDay = new Map<string, object[]>();

      for (const e of items) {
        const allDay = Boolean(e.start?.date && !e.start?.dateTime);
        const startDate = allDay ? e.start!.date! : localDate(tz, new Date(e.start?.dateTime ?? ""));
        let time = "all day";
        if (!allDay && e.start?.dateTime && e.end?.dateTime) {
          const s = new Date(e.start.dateTime);
          const en = new Date(e.end.dateTime);
          time = `${formatTime(s, tz)}–${formatTime(en, tz)}`;
          timed.push({ title: e.summary ?? "(no title)", start: s, end: en });
        }
        const attendees = (e.attendees ?? []).filter((a) => !a.self);
        const self = (e.attendees ?? []).find((a) => a.self);
        const event = {
          time,
          title: e.summary ?? "(no title)",
          location: e.location,
          description:
            e.description && e.description.length > MAX_DESCRIPTION
              ? `${e.description.slice(0, MAX_DESCRIPTION)}…`
              : e.description,
          scheduled_in_time_zone: e.start?.timeZone && e.start.timeZone !== tz ? e.start.timeZone : undefined,
          organizer: e.organizer?.self ? "you" : (e.organizer?.displayName ?? e.organizer?.email),
          attendees: attendees.length
            ? attendees.slice(0, MAX_ATTENDEES).map((a) => `${a.displayName ?? a.email} (${a.responseStatus ?? "unknown"})`)
            : undefined,
          more_attendees: attendees.length > MAX_ATTENDEES ? attendees.length - MAX_ATTENDEES : undefined,
          your_response: self?.responseStatus,
          video_call: e.hangoutLink,
          recurring: e.recurringEventId ? true : undefined,
          type: e.eventType && e.eventType !== "default" ? e.eventType : undefined,
        };
        byDay.set(startDate, [...(byDay.get(startDate) ?? []), event]);
      }

      const { conflicts, free } = digestDays(span.start, span.end, timed, tz);
      return {
        calendar: data.summary ?? calendarId,
        time_zone: tz,
        count: items.length,
        more_not_shown: Boolean(data.nextPageToken) || undefined,
        conflicts: conflicts.length ? conflicts : "none",
        free_time_window: DAY_WINDOW.label,
        days: free.map(({ date, free_blocks }) => ({
          day: dayLabel(date),
          events: byDay.get(date) ?? [],
          free_blocks: free_blocks.length ? free_blocks : "none",
        })),
      };
    } catch (err) {
      return notConnected(err);
    }
  },
  summarize(output) {
    const o = output as { count?: number; error?: string };
    if (o.error === "not_connected") return "Not connected";
    if (o.error) return "Invalid request";
    return `${o.count ?? 0} event${o.count === 1 ? "" : "s"}`;
  },
});

export const googleCalendarRuntime: PluginRuntime = {
  id: "google-calendar",
  tools: [listCalendars, listEvents],
  promptNotes:
    "Google Calendar (read-only): use gcal_list_events whenever a question depends on the user's schedule, instead of guessing. " +
    "You can't create, change or delete events. If a tool says the calendar isn't connected, tell the user to connect it on the Plugins page.",
};
