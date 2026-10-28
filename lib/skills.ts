import type { Skill } from "./types";

const BUILT_IN_DATE = "2026-01-01T00:00:00.000Z";

function skill(s: Omit<Skill, "builtIn" | "createdAt">): Skill {
  return { ...s, builtIn: true, createdAt: BUILT_IN_DATE };
}

/** Skills that ship with the app. Users can add their own on the Skills page. */
export const BUILT_IN_SKILLS: Skill[] = [
  skill({
    id: "daily-briefing",
    name: "Daily briefing",
    emoji: "🗞️",
    description: "Turns a schedule into a short, readable rundown of the day.",
    instructions: `When the user asks what their day or week looks like, give a briefing rather than a raw list.
- Open with one line that sums up the day (e.g. "Busy morning, open afternoon").
- List events in time order with their times, title, and location if there is one.
- Mention the free blocks of an hour or more, copied from the calendar tool's free_blocks.
- Call out anything that needs preparation or an early start.`,
  }),
  skill({
    id: "conflict-spotter",
    name: "Conflict spotter",
    emoji: "⚠️",
    description: "Flags overlaps, double-bookings and back-to-back marathons.",
    instructions: `Whenever you look at a schedule, check it for problems and mention any you find:
- Overlapping or double-booked events. The calendar tool lists these under "conflicts"; always report every one.
- Three or more meetings back to back with no break.
- Events outside normal waking hours (before 7am or after 10pm).
If there are no problems, don't mention this check.`,
  }),
  skill({
    id: "time-zone-aware",
    name: "Time-zone aware",
    emoji: "🌍",
    description: "Reads and reports every time in the user's local time zone.",
    instructions: `Interpret every time the user mentions in their local time zone (given in the context block of each message) unless they name another zone.
Report times in the user's local zone. If an event was scheduled in a different zone, show both, e.g. "9:00 AM (12:00 PM New York)".`,
  }),
  skill({
    id: "concise-replies",
    name: "Concise replies",
    emoji: "✂️",
    description: "Short, scannable answers without filler.",
    instructions: `Keep replies short and easy to scan. Lead with the answer. Use bullet points for lists of three or more items. Skip greetings, restating the question, and closing offers of further help.`,
  }),
  skill({
    id: "ask-before-acting",
    name: "Ask before acting",
    emoji: "✋",
    description: "Never takes an action with side effects without a clear yes.",
    instructions: `Looking things up is always fine. Before any action that changes something outside this chat (sending, booking, buying, deleting, inviting), describe exactly what you are about to do and wait for the user to say yes.`,
  }),
  skill({
    id: "meal-planner",
    name: "Meal planner",
    emoji: "🥗",
    description: "Plans meals around the week and turns them into a shopping list.",
    instructions: `When planning meals, ask about dietary needs and how many people you are cooking for if you don't know.
Plan simple meals on busy days and more involved ones on free evenings.
Finish with a shopping list grouped by store section (produce, dairy, pantry, meat & fish, frozen, other).`,
  }),
  skill({
    id: "pantry-tracker",
    name: "Pantry tracker",
    emoji: "🧺",
    description: "Keeps a running list of staples and what needs restocking.",
    instructions: `Keep track of the staples the user mentions having or running out of during the conversation.
When asked what to buy, combine what is running low with anything needed for planned meals, and leave out what they already have.`,
  }),
  skill({
    id: "security-triage",
    name: "Security triage",
    emoji: "🛡️",
    description: "Sorts camera events by how much they matter.",
    instructions: `Sort each camera event as: person, package, vehicle, animal, or other.
Treat as urgent: an unknown person lingering, a door or window opening while the user is away, or activity late at night.
Group routine events (deliveries, passing cars, pets) into a short summary instead of listing each one.`,
  }),
  skill({
    id: "event-planning",
    name: "Event planning",
    emoji: "🎉",
    description: "Plans gatherings from guest list to day-of timeline.",
    instructions: `When helping plan an event, work through: purpose and size, date options (check the calendar for free slots if you can), venue, budget, guest list, and a day-of timeline.
Offer two or three concrete options at each decision point instead of open-ended questions.`,
  }),
  skill({
    id: "privacy-guard",
    name: "Privacy guard",
    emoji: "🔒",
    description: "Keeps personal details to what the task needs.",
    instructions: `Only mention other people's contact details, notes, or private event descriptions when the user's request needs them. Never include passwords, door codes, or account numbers you come across in your replies.`,
  }),
];
