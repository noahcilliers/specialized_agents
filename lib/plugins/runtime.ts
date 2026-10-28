import type { PluginRuntime, PluginTool } from "./tool";
import { googleCalendarRuntime } from "./google-calendar/tools";
import { getConnectionInfo, isConfigured } from "./google-calendar/oauth";

/** Server-side plugin registry: which tools each plugin gives an agent. */
const RUNTIMES: Record<string, PluginRuntime> = {
  [googleCalendarRuntime.id]: googleCalendarRuntime,
};

export function getPluginRuntime(id: string): PluginRuntime | undefined {
  return RUNTIMES[id];
}

export function toolsForPlugins(pluginIds: string[]): PluginTool[] {
  return pluginIds.flatMap((id) => RUNTIMES[id]?.tools ?? []);
}

export function findTool(name: string): PluginTool | undefined {
  for (const runtime of Object.values(RUNTIMES)) {
    const tool = runtime.tools.find((t) => t.name === name);
    if (tool) return tool;
  }
  return undefined;
}

export interface PluginStatus {
  /** Server has the credentials it needs (e.g. OAuth client ID). */
  configured: boolean;
  connected: boolean;
  account: string | null;
}

export async function getPluginStatus(id: string): Promise<PluginStatus> {
  if (id === "google-calendar") {
    const info = await getConnectionInfo();
    return { configured: isConfigured(), connected: Boolean(info), account: info?.email ?? null };
  }
  return { configured: false, connected: false, account: null };
}

export async function getAllPluginStatuses(): Promise<Record<string, PluginStatus>> {
  const entries = await Promise.all(Object.keys(RUNTIMES).map(async (id) => [id, await getPluginStatus(id)] as const));
  return Object.fromEntries(entries);
}
