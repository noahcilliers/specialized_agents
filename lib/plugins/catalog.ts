/**
 * Plugin metadata that is safe to use in the browser. The server-side tool
 * implementations live next to each plugin (e.g. lib/plugins/google-calendar).
 */

export type PluginIcon = "calendar" | "camera" | "cart" | "mail" | "home" | "ticket" | "message";

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  icon: PluginIcon;
  availability: "available" | "coming_soon";
  access?: string;
  tools: { name: string; description: string }[];
}

export const PLUGINS: PluginInfo[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Let an agent read your calendars and events.",
    icon: "calendar",
    availability: "available",
    access: "Read-only",
    tools: [
      { name: "gcal_list_calendars", description: "See which calendars you have" },
      { name: "gcal_list_events", description: "Read events in a date range, optionally filtered by keyword" },
    ],
  },
  {
    id: "security-cameras",
    name: "Security Cameras",
    description: "Watch camera feeds and motion events.",
    icon: "camera",
    availability: "coming_soon",
    tools: [],
  },
  {
    id: "grocery-delivery",
    name: "Grocery Delivery",
    description: "Build carts and schedule grocery orders.",
    icon: "cart",
    availability: "coming_soon",
    tools: [],
  },
  {
    id: "email",
    name: "Email",
    description: "Read and draft email on your behalf.",
    icon: "mail",
    availability: "coming_soon",
    tools: [],
  },
  {
    id: "smart-home",
    name: "Smart Home",
    description: "Check and control lights, locks and thermostats.",
    icon: "home",
    availability: "coming_soon",
    tools: [],
  },
  {
    id: "event-tickets",
    name: "Event Tickets",
    description: "Find events and hold tickets.",
    icon: "ticket",
    availability: "coming_soon",
    tools: [],
  },
];

export function getPluginInfo(id: string): PluginInfo | undefined {
  return PLUGINS.find((p) => p.id === id);
}

export function isAvailablePlugin(id: string): boolean {
  return getPluginInfo(id)?.availability === "available";
}
