import type { AgentColor } from "./types";

// Full class names are spelled out so Tailwind can find them at build time.
export const AGENT_COLORS: Record<AgentColor, { tile: string; ring: string; dot: string; soft: string }> = {
  violet: { tile: "bg-violet-100", ring: "ring-violet-200", dot: "bg-violet-500", soft: "bg-violet-50" },
  sky: { tile: "bg-sky-100", ring: "ring-sky-200", dot: "bg-sky-500", soft: "bg-sky-50" },
  emerald: { tile: "bg-emerald-100", ring: "ring-emerald-200", dot: "bg-emerald-500", soft: "bg-emerald-50" },
  amber: { tile: "bg-amber-100", ring: "ring-amber-200", dot: "bg-amber-500", soft: "bg-amber-50" },
  rose: { tile: "bg-rose-100", ring: "ring-rose-200", dot: "bg-rose-500", soft: "bg-rose-50" },
  slate: { tile: "bg-slate-200", ring: "ring-slate-300", dot: "bg-slate-500", soft: "bg-slate-50" },
};

export const COLOR_KEYS = Object.keys(AGENT_COLORS) as AgentColor[];

export function isAgentColor(value: unknown): value is AgentColor {
  return typeof value === "string" && value in AGENT_COLORS;
}
