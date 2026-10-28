import { z } from "zod";
import { COLOR_KEYS } from "./colors";
import { PLUGINS } from "./plugins/catalog";

const availablePluginIds = PLUGINS.filter((p) => p.availability === "available").map((p) => p.id);

export const agentInputSchema = z.object({
  name: z.string().trim().min(1, "Give your agent a name").max(60),
  emoji: z.string().trim().min(1).max(16),
  color: z.enum(COLOR_KEYS as [string, ...string[]]),
  description: z.string().trim().max(240),
  systemPrompt: z.string().max(20_000),
  skillIds: z.array(z.string()).max(30),
  pluginIds: z
    .array(z.string())
    .max(20)
    .refine((ids) => ids.every((id) => availablePluginIds.includes(id)), "Unknown or unavailable plugin"),
  model: z
    .string()
    .trim()
    .max(200)
    .regex(/^[\w.:/-]+$/, "That doesn't look like an Ollama model name")
    .nullable(),
  think: z.boolean(),
  status: z.enum(["running", "sleeping"]),
});

export const agentPatchSchema = agentInputSchema.partial();

export const skillInputSchema = z.object({
  name: z.string().trim().min(1, "Give the skill a name").max(60),
  emoji: z.string().trim().min(1).max(16),
  description: z.string().trim().max(200),
  instructions: z.string().trim().min(1, "Write the skill's instructions").max(10_000),
});

export const skillPatchSchema = skillInputSchema.partial();

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  timeZone: z.string().max(64).optional(),
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request";
}
