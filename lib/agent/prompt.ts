import type { Agent, Skill } from "../types";
import { getPluginInfo } from "../plugins/catalog";
import { getPluginRuntime, toolsForPlugins } from "../plugins/runtime";
import type { PluginTool } from "../plugins/tool";

/**
 * Build an agent's full system prompt: the user's instructions, a short role
 * statement that keeps the agent in its lane, then its skills and plugins.
 * Deterministic for a given setup, so it can be compared to detect edits.
 */
export function composeSystemPrompt(agent: Agent, allSkills: Skill[]): string {
  const sections: string[] = [];

  if (agent.systemPrompt.trim()) sections.push(agent.systemPrompt.trim());

  sections.push(
    [
      "# Your role",
      `You are "${agent.name}", one of several specialized personal agents that work for the user. Each agent has one narrow job.` +
        (agent.description.trim() ? ` Yours: ${agent.description.trim()}` : ""),
      "Stay within that job. If the user asks for something outside it, say so in a sentence and suggest they ask a different agent.",
      "Each user message starts with a <context> block with today's date, the current time and the time zone. Use it to work out what today, tomorrow or next week mean. Never mention the context block itself.",
    ].join("\n"),
  );

  const skills = agent.skillIds
    .map((id) => allSkills.find((s) => s.id === id))
    .filter((s): s is Skill => Boolean(s));
  if (skills.length) {
    sections.push(
      ["# Skills", ...skills.map((s) => `## ${s.name}\n${s.instructions.trim()}`)].join("\n\n"),
    );
  }

  const plugins = agent.pluginIds
    .map((id) => ({ info: getPluginInfo(id), runtime: getPluginRuntime(id) }))
    .filter((p) => p.info && p.runtime);
  if (plugins.length) {
    sections.push(
      [
        "# Plugins",
        ...plugins.map((p) => `- ${p.runtime!.promptNotes}`),
        "Only say you did something if a tool actually did it. If a tool returns an error, tell the user plainly what went wrong and what they can do about it.",
      ].join("\n"),
    );
  } else {
    sections.push(
      "# Plugins\nYou have no plugins yet, so you can't look anything up or take actions outside this chat. Be upfront about that when it matters.",
    );
  }

  return sections.join("\n\n");
}

export function agentTools(agent: Agent): PluginTool[] {
  return toolsForPlugins(agent.pluginIds);
}
