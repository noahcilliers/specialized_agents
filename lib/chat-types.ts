/** Chat types shared by the server (stream + history) and the browser. */

export interface ToolPart {
  kind: "tool";
  id: string;
  name: string;
  label: string;
  detail?: string;
  input: unknown;
  status: "running" | "ok" | "error";
  summary?: string;
  output?: string;
}

export type DisplayPart =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | ToolPart
  | { kind: "notice"; text: string };

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  parts: DisplayPart[];
  error?: string;
}

/** Events streamed (as NDJSON) from POST /api/agents/[id]/chat. */
export type ChatEvent =
  | { type: "step_start" }
  | { type: "thinking"; text: string }
  | { type: "text_start" }
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; label: string; detail?: string; input: unknown }
  | { type: "tool_result"; id: string; ok: boolean; summary: string; output: string }
  | { type: "notice"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
