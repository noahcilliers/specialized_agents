import type { Message } from "ollama";

export type AgentStatus = "running" | "sleeping";
export type AgentColor = "violet" | "sky" | "emerald" | "amber" | "rose" | "slate";

/** A specialized agent: one narrow job, its own instructions, skills and plugins. */
export interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: AgentColor;
  description: string;
  systemPrompt: string;
  skillIds: string[];
  pluginIds: string[];
  /** Ollama model name, e.g. "qwen3:8b". null means "use the default local model". */
  model: string | null;
  /** Let thinking-capable models reason before answering (smarter, much slower locally). */
  think: boolean;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

/** Fields a user can set when creating or editing an agent. */
export type AgentInput = Pick<
  Agent,
  "name" | "emoji" | "color" | "description" | "systemPrompt" | "skillIds" | "pluginIds" | "model" | "think" | "status"
>;

/** A skill is reusable know-how (instructions) that can be added to any agent. */
export interface Skill {
  id: string;
  name: string;
  emoji: string;
  description: string;
  instructions: string;
  builtIn: boolean;
  createdAt: string;
}

export type SkillInput = Pick<Skill, "name" | "emoji" | "description" | "instructions">;

/** A stored chat message. Tool results also remember which call they answer. */
export type StoredMessage = Message & { tool_call_id?: string };

/** One chat thread with an agent. The agent's current setup applies to every turn. */
export interface Conversation {
  startedAt: string;
  messages: StoredMessage[];
}

export type ActivityKind = "created" | "updated" | "woke" | "slept" | "chat" | "error";

export interface ActivityEntry {
  id: string;
  agentId: string;
  at: string;
  kind: ActivityKind;
  summary: string;
  detail?: string;
}

export interface Database {
  version: 2;
  agents: Agent[];
  /** Custom skills only. Built-in skills live in code (lib/skills.ts). */
  skills: Skill[];
  conversations: Record<string, Conversation>;
  activity: ActivityEntry[];
}
