import type { z } from "zod";

export interface ToolContext {
  timeZone: string;
}

/** JSON Schema for a tool's input, as sent to the model. */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

/** A single action a plugin gives an agent. */
export interface PluginTool<I = unknown> {
  name: string;
  /** Short label shown in the chat, e.g. "Checked Google Calendar". */
  label: string;
  description: string;
  inputSchema: ToolInputSchema;
  /** Runtime validation for the model's input. Local models get arguments wrong sometimes. */
  schema: z.ZodType<I>;
  /** One-line description of a call, e.g. "tomorrow". */
  describe?: (input: I) => string;
  run: (input: I, ctx: ToolContext) => Promise<unknown>;
  /** One-line summary of a result, e.g. "6 events". */
  summarize: (output: unknown) => string;
}

export interface PluginRuntime {
  id: string;
  tools: PluginTool[];
  /** Extra guidance added to the system prompt of agents that use this plugin. */
  promptNotes: string;
}

export function defineTool<I>(tool: PluginTool<I>): PluginTool {
  return tool as unknown as PluginTool;
}
