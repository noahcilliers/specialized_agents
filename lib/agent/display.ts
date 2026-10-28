import type { Conversation } from "../types";
import type { DisplayMessage, ToolPart } from "../chat-types";
import { stripContext } from "../time";
import { findTool } from "../plugins/runtime";

/** Convert a stored thread into chat bubbles: one per user message, one per assistant turn. */
export function toDisplayMessages(conversation: Conversation | null): DisplayMessage[] {
  if (!conversation) return [];
  const out: DisplayMessage[] = [];
  const toolParts = new Map<string, ToolPart>();
  let assistant: DisplayMessage | null = null;

  conversation.messages.forEach((msg, index) => {
    if (msg.role === "user") {
      assistant = null;
      out.push({ id: `m${index}`, role: "user", parts: [{ kind: "text", text: stripContext(msg.content) }] });
      return;
    }

    if (msg.role === "tool") {
      const part =
        (msg.tool_call_id && toolParts.get(msg.tool_call_id)) ||
        [...toolParts.values()].find((p) => p.status === "running" && p.name === msg.tool_name);
      if (!part) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(msg.content);
      } catch {
        parsed = null;
      }
      const failed = !parsed || (typeof parsed === "object" && "error" in parsed);
      part.status = failed ? "error" : "ok";
      part.output = msg.content;
      const tool = findTool(part.name);
      try {
        part.summary = tool && parsed ? tool.summarize(parsed) : undefined;
      } catch {
        part.summary = undefined;
      }
      return;
    }

    if (msg.role !== "assistant") return;
    if (!assistant) {
      assistant = { id: `m${index}`, role: "assistant", parts: [] };
      out.push(assistant);
    }
    if (msg.thinking) assistant.parts.push({ kind: "thinking", text: msg.thinking });
    if (msg.content) assistant.parts.push({ kind: "text", text: msg.content });
    for (const call of msg.tool_calls ?? []) {
      const id = (call as { id?: string }).id ?? `${index}-${call.function.name}`;
      const tool = findTool(call.function.name);
      const parsed = tool?.schema.safeParse(call.function.arguments);
      const part: ToolPart = {
        kind: "tool",
        id,
        name: call.function.name,
        label: tool?.label ?? call.function.name,
        detail: tool?.describe && parsed?.success ? tool.describe(parsed.data) : undefined,
        input: call.function.arguments,
        status: "running",
      };
      toolParts.set(id, part);
      assistant.parts.push(part);
    }
  });

  return out;
}
