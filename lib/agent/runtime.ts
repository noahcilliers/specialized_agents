import type { Message, Tool, ToolCall } from "ollama";
import type { Agent, Conversation, Skill, StoredMessage } from "../types";
import type { ChatEvent } from "../chat-types";
import { contextBlock } from "../time";
import { KEEP_ALIVE, NUM_CTX, OLLAMA_HOST, ollamaClient, type LocalModel } from "../ollama";
import type { PluginTool } from "../plugins/tool";
import { agentTools, composeSystemPrompt } from "./prompt";

const MAX_TOOL_ROUNDS = 8;
/** Rough budget for chat history, leaving room for the system prompt, tools and the reply. */
const HISTORY_CHAR_BUDGET = Math.floor(NUM_CTX * 3 * 0.55);
const MAX_TOOL_OUTPUT_CHARS = 12_000;

export function newConversation(): Conversation {
  return { startedAt: new Date().toISOString(), messages: [] };
}

export interface TurnResult {
  ok: boolean;
  text: string;
  toolCalls: { name: string; label: string; summary: string; ok: boolean }[];
}

export class UserFacingError extends Error {}

/**
 * Run one user turn on a local Ollama model: stream the reply, run any tool
 * calls, and loop until the model answers. Uses the agent's current setup, so
 * edits apply immediately. If the turn fails, its messages are rolled back.
 */
export async function* runTurn(args: {
  agent: Agent;
  skills: Skill[];
  model: LocalModel;
  conversation: Conversation;
  userText: string;
  timeZone: string;
  signal: AbortSignal;
  result: TurnResult;
}): AsyncGenerator<ChatEvent> {
  const { agent, skills, model, conversation, userText, timeZone, signal, result } = args;
  const history = conversation.messages;
  const startLength = history.length;

  const pluginTools = agentTools(agent);
  const tools = model.tools ? pluginTools : [];
  if (pluginTools.length && !model.tools) {
    yield { type: "notice", text: `${model.name} can't use plugins, so this answer comes without them.` };
  }
  const system = composeSystemPrompt(agent, skills);

  history.push({ role: "user", content: `${contextBlock(timeZone)}\n\n${userText}` });

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      yield { type: "step_start" };
      const client = ollamaClient();
      const stream = await client.chat({
        model: model.name,
        stream: true,
        messages: [{ role: "system", content: system }, ...fitHistory(history).map(toOllamaMessage)],
        ...(tools.length ? { tools: tools.map(toOllamaTool) } : {}),
        ...(model.thinking ? { think: agent.think } : {}),
        options: { num_ctx: NUM_CTX },
        keep_alive: KEEP_ALIVE,
      });
      const onAbort = () => stream.abort();
      signal.addEventListener("abort", onAbort);

      let content = "";
      let thinking = "";
      const toolCalls: ToolCall[] = [];
      try {
        for await (const chunk of stream) {
          const m = chunk.message;
          if (m.thinking) {
            thinking += m.thinking;
            yield { type: "thinking", text: m.thinking };
          }
          if (m.content) {
            if (!content) yield { type: "text_start" };
            content += m.content;
            yield { type: "text", text: m.content };
          }
          if (m.tool_calls?.length) toolCalls.push(...m.tool_calls);
        }
      } finally {
        signal.removeEventListener("abort", onAbort);
      }
      if (signal.aborted) throw new UserFacingError("Stopped.");

      const calls = toolCalls.map((call, i) => ({
        id: (call as ToolCall & { id?: string }).id || `call_${Date.now().toString(36)}_${round}_${i}`,
        name: call.function.name,
        args: call.function.arguments ?? {},
      }));

      history.push({
        role: "assistant",
        content,
        ...(thinking ? { thinking } : {}),
        ...(calls.length
          ? { tool_calls: calls.map((c) => ({ id: c.id, function: { name: c.name, arguments: c.args } }) as ToolCall) }
          : {}),
      });
      result.text += content;

      if (calls.length === 0) {
        result.ok = true;
        return;
      }

      // Announce every call, then run them in parallel.
      const planned = calls.map((call) => {
        const tool = tools.find((t) => t.name === call.name);
        const parsed = tool?.schema.safeParse(call.args);
        return { call, tool, parsed };
      });
      for (const { call, tool, parsed } of planned) {
        yield {
          type: "tool_call",
          id: call.id,
          name: call.name,
          label: tool?.label ?? call.name,
          detail: tool && parsed?.success && tool.describe ? tool.describe(parsed.data) : undefined,
          input: call.args,
        };
      }

      const outcomes = await Promise.all(planned.map((p) => execute(p.call, p.tool, p.parsed, timeZone)));
      for (const { call, tool, ok, output, summary } of outcomes) {
        result.toolCalls.push({ name: call.name, label: tool?.label ?? call.name, summary, ok });
        yield { type: "tool_result", id: call.id, ok, summary, output };
        history.push({ role: "tool", content: output, tool_name: call.name, tool_call_id: call.id });
      }
    }
    throw new UserFacingError("The agent used too many steps on this request and stopped.");
  } catch (err) {
    history.length = startLength;
    throw err;
  }
}

async function execute(
  call: { id: string; name: string; args: Record<string, unknown> },
  tool: PluginTool | undefined,
  parsed: ReturnType<PluginTool["schema"]["safeParse"]> | undefined,
  timeZone: string,
) {
  const fail = (value: object) => ({ call, tool, ok: false, output: JSON.stringify(value), summary: "Failed" });
  if (!tool) return fail({ error: `There is no tool called ${call.name}.` });
  if (!parsed?.success) {
    return {
      ...fail({ error: "invalid_arguments", details: parsed?.error.issues.map((i) => i.message).join("; ") }),
      summary: "Invalid request",
    };
  }
  try {
    const value = await tool.run(parsed.data, { timeZone });
    const ok = !(typeof value === "object" && value !== null && "error" in value);
    let output = JSON.stringify(value);
    if (output.length > MAX_TOOL_OUTPUT_CHARS) {
      output = `${output.slice(0, MAX_TOOL_OUTPUT_CHARS)}… [truncated: ask for a narrower range for the rest]`;
    }
    return { call, tool, ok, output, summary: safeSummary(tool, value) };
  } catch (err) {
    return fail({ error: (err as Error).message });
  }
}

function safeSummary(tool: PluginTool, value: unknown): string {
  try {
    return tool.summarize(value);
  } catch {
    return "Done";
  }
}

function toOllamaTool(tool: PluginTool): Tool {
  return {
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  };
}

/** Drop our bookkeeping fields before sending to Ollama. */
function toOllamaMessage({ role, content, thinking, tool_calls, tool_name }: StoredMessage): Message {
  return { role, content, thinking, tool_calls, tool_name };
}

const messageSize = (m: StoredMessage) =>
  m.content.length + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0);

/**
 * Keep as much recent history as fits a local model's context window. Cuts only
 * at user messages so tool calls stay paired with their results.
 */
function fitHistory(history: StoredMessage[]): StoredMessage[] {
  let lastUser = history.length - 1;
  while (lastUser > 0 && history[lastUser].role !== "user") lastUser--;
  let total = 0;
  let start = lastUser;
  for (let i = history.length - 1; i >= 0; i--) {
    total += messageSize(history[i]);
    if (total > HISTORY_CHAR_BUDGET && i < lastUser) break;
    if (history[i].role === "user") start = Math.min(start, i);
  }
  return history.slice(start);
}

/** Turn any error from a turn into a message the user can act on. */
export function describeError(err: unknown, modelName?: string): string {
  if (err instanceof UserFacingError) return err.message;
  const e = err as Error & { status_code?: number; cause?: { code?: string } };
  if (e?.cause?.code === "ECONNREFUSED" || /fetch failed|ECONNREFUSED/i.test(e?.message ?? "")) {
    return `Can't reach Ollama at ${OLLAMA_HOST}. Open the Ollama app (or run \`ollama serve\`) and try again.`;
  }
  if (e?.status_code === 404 || /not found/i.test(e?.message ?? "")) {
    return modelName
      ? `The model ${modelName} isn't installed. Run \`ollama pull ${modelName}\` or pick another model in the agent's settings.`
      : e.message;
  }
  if (/does not support tools/i.test(e?.message ?? "")) {
    return `${modelName ?? "This model"} can't use plugins. Pick a model with tool support in the agent's settings.`;
  }
  if (/does not support thinking/i.test(e?.message ?? "")) {
    return `${modelName ?? "This model"} can't do deep thinking. Turn it off in the agent's settings.`;
  }
  return e instanceof Error ? `Ollama error: ${e.message}` : "Something went wrong.";
}
