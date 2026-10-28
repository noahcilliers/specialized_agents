"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowUp, Brain, ChevronRight, CircleCheck, Info, Loader2, Moon, RotateCcw, Square } from "lucide-react";
import type { ChatEvent, DisplayMessage, DisplayPart, ToolPart } from "@/lib/chat-types";
import type { AgentColor, AgentStatus } from "@/lib/types";
import { AgentAvatar } from "./agent-avatar";
import { PluginIcon } from "./plugin-icon";
import { Markdown } from "./markdown";
import { Button } from "./ui";
import { StatusToggle } from "./status-toggle";

let uid = 0;
const nextId = () => `local-${Date.now()}-${uid++}`;

export interface ChatProps {
  agentId: string;
  name: string;
  emoji: string;
  color: AgentColor;
  status: AgentStatus;
  initialMessages: DisplayMessage[];
  thinkingEnabled: boolean;
  starters: string[];
  notices: { text: string; href?: string; cta?: string }[];
}

export function Chat(props: ChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<DisplayMessage[]>(props.initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const asleep = props.status === "sleeping";

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function onScroll() {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || asleep) return;
    setInput("");
    setBusy(true);
    stickToBottom.current = true;

    const assistantId = nextId();
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "user", parts: [{ kind: "text", text: message }] },
      { id: assistantId, role: "assistant", parts: [] },
    ]);

    // Build the reply in a local array and push copies into state once per frame.
    const parts: DisplayPart[] = [];
    let error: string | undefined;
    let frame = 0;
    const flush = () => {
      frame = 0;
      const snapshot = [...parts];
      setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, parts: snapshot, error } : msg)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const apply = (event: ChatEvent) => {
      switch (event.type) {
        case "thinking": {
          const last = parts[parts.length - 1];
          if (last?.kind === "thinking") parts[parts.length - 1] = { ...last, text: last.text + event.text };
          else parts.push({ kind: "thinking", text: event.text });
          break;
        }
        case "text_start":
          parts.push({ kind: "text", text: "" });
          break;
        case "text": {
          const last = parts[parts.length - 1];
          if (last?.kind === "text") parts[parts.length - 1] = { ...last, text: last.text + event.text };
          else parts.push({ kind: "text", text: event.text });
          break;
        }
        case "tool_call":
          parts.push({
            kind: "tool",
            id: event.id,
            name: event.name,
            label: event.label,
            detail: event.detail,
            input: event.input,
            status: "running",
          });
          break;
        case "tool_result": {
          const i = parts.findIndex((p) => p.kind === "tool" && p.id === event.id);
          if (i >= 0) {
            parts[i] = {
              ...(parts[i] as ToolPart),
              status: event.ok ? "ok" : "error",
              summary: event.summary,
              output: event.output,
            };
          }
          break;
        }
        case "notice":
          parts.push({ kind: "notice", text: event.text });
          break;
        case "error":
          error = event.message;
          break;
      }
      schedule();
    };

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/agents/${props.agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) apply(JSON.parse(line) as ChatEvent);
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) error = (err as Error).message;
      else error = "Stopped.";
    } finally {
      if (frame) cancelAnimationFrame(frame);
      flush();
      abortRef.current = null;
      setBusy(false);
      router.refresh();
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  async function newChat() {
    if (busy) return;
    await fetch(`/api/agents/${props.agentId}/conversation`, { method: "DELETE" });
    setMessages([]);
    router.refresh();
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-17rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5">
        <p className="text-sm text-zinc-500">{empty ? "New chat" : "Chat"}</p>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={newChat} disabled={busy || empty}>
          <RotateCcw className="h-3.5 w-3.5" /> New chat
        </Button>
      </div>


      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {empty ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
            <AgentAvatar emoji={props.emoji} color={props.color} size="lg" />
            <p className="mt-4 font-semibold text-zinc-900">Chat with {props.name}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {asleep
                ? `${props.name} is asleep right now.`
                : props.thinkingEnabled
                  ? "Deep thinking is on, so replies are slower but more careful."
                  : "Ask it something within its job. It runs on your computer."}
            </p>
            {!asleep && props.starters.length ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {props.starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm text-zinc-700 shadow-xs transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((m, i) => (
              <MessageView
                key={m.id}
                message={m}
                emoji={props.emoji}
                color={props.color}
                streaming={busy && i === messages.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {props.notices.length ? (
        <div className="space-y-1 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5">
          {props.notices.map((n) => (
            <p key={n.text} className="flex items-center gap-2 text-sm text-zinc-600">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>{n.text}</span>
              {n.href ? (
                <Link href={n.href} className="font-medium text-zinc-900 underline underline-offset-2">
                  {n.cta ?? "Fix"}
                </Link>
              ) : null}
            </p>
          ))}
        </div>
      ) : null}

      <div className="border-t border-zinc-100 p-3 sm:p-4">
        {asleep ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-zinc-600">
              <Moon className="h-4 w-4" /> {props.name} is sleeping and won&apos;t respond.
            </p>
            <StatusToggle agentId={props.agentId} status={props.status} showLabel />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs focus-within:border-zinc-300 focus-within:ring-4 focus-within:ring-zinc-900/5"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={`Message ${props.name}…`}
              className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
              disabled={busy}
            />
            {busy ? (
              <Button size="sm" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Stop">
                <Square className="h-3 w-3 fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={!input.trim()} aria-label="Send">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function MessageView({
  message,
  emoji,
  color,
  streaming,
}: {
  message: DisplayMessage;
  emoji: string;
  color: AgentColor;
  streaming: boolean;
}) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.kind === "text" ? p.text : "")).join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-[15px] leading-6 text-white">
          {text}
        </div>
      </div>
    );
  }

  const visible = message.parts.filter((p) => !((p.kind === "text" || p.kind === "thinking") && !p.text.trim()));
  const waiting = streaming && visible.length === 0 && !message.error;

  return (
    <div className="flex gap-3">
      <div className="pt-0.5">
        <AgentAvatar emoji={emoji} color={color} size="sm" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {waiting ? (
          <p className="flex items-center gap-2 pt-1.5 text-sm text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </p>
        ) : null}
        {visible.map((part, i) =>
          part.kind === "text" ? (
            <Markdown key={i}>{part.text}</Markdown>
          ) : part.kind === "thinking" ? (
            <ThinkingBlock key={i} text={part.text} live={streaming && i === visible.length - 1} />
          ) : part.kind === "tool" ? (
            <ToolChip key={part.id} part={part} />
          ) : (
            <p key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Info className="h-3.5 w-3.5" /> {part.text}
            </p>
          ),
        )}
        {message.error ? (
          <p className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {message.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ToolChip({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false);
  let output = part.output;
  try {
    if (output) output = JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    // leave as-is
  }
  const icon = part.name.startsWith("gcal_") ? "calendar" : "message";

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-50"
        aria-expanded={open}
      >
        <PluginIcon icon={icon} size="sm" />
        <span className="font-medium text-zinc-800">{part.label}</span>
        {part.detail ? <span className="hidden truncate text-zinc-500 sm:inline">{part.detail}</span> : null}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
          {part.status === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
          ) : part.status === "ok" ? (
            <span className="flex items-center gap-1 text-emerald-700">
              <CircleCheck className="h-3.5 w-3.5" /> {part.summary}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> {part.summary ?? "Failed"}
            </span>
          )}
          <ChevronRight className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`} />
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-zinc-200 bg-white px-3 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">{part.name} · input</p>
          <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-50 p-2.5 font-mono text-xs text-zinc-700">
            {JSON.stringify(part.input, null, 2)}
          </pre>
          {output ? (
            <>
              <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">result</p>
              <pre className="max-h-72 overflow-auto rounded-lg bg-zinc-50 p-2.5 font-mono text-xs text-zinc-700">{output}</pre>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ThinkingBlock({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  const words = text.trim().split(/\s+/).length;
  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-600"
        aria-expanded={open}
      >
        {live ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
        {live ? `Thinking… (${words} words)` : `Reasoned for ${words} words`}
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? (
        <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap border-l-2 border-zinc-200 pl-3 text-[13px] leading-5 text-zinc-500">
          {text.trim()}
        </p>
      ) : null}
    </div>
  );
}
