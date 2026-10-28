import { getAgent, getConversation, listSkills, recordTurn, saveConversation } from "@/lib/db";
import { chatRequestSchema, firstIssue } from "@/lib/validate";
import { describeError, newConversation, runTurn, type TurnResult } from "@/lib/agent/runtime";
import { findModel, getOllamaStatus, OLLAMA_HOST, resolveModel } from "@/lib/ollama";
import { isValidTimeZone, serverTimeZone } from "@/lib/time";
import type { ChatEvent } from "@/lib/chat-types";

/** Send a message to an agent. Streams ChatEvents back as newline-delimited JSON. */
export async function POST(req: Request, ctx: RouteContext<"/api/agents/[id]/chat">) {
  const { id } = await ctx.params;
  const parsed = chatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const agent = await getAgent(id);
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
  if (agent.status === "sleeping") {
    return Response.json({ error: `${agent.name} is asleep. Wake it up to chat.` }, { status: 409 });
  }

  const ollama = await getOllamaStatus();
  if (!ollama.running) {
    return Response.json(
      { error: `Can't reach Ollama at ${OLLAMA_HOST}. Open the Ollama app (or run \`ollama serve\`) and try again.` },
      { status: 503 },
    );
  }
  const modelName = resolveModel(agent.model, ollama);
  const model = modelName ? findModel(ollama.models, modelName) : undefined;
  if (!model) {
    return Response.json(
      {
        error: modelName
          ? `The model ${modelName} isn't installed. Run \`ollama pull ${modelName}\` or pick another model in the agent's settings.`
          : "No local models are installed yet. Run `ollama pull qwen3:8b` and try again.",
      },
      { status: 400 },
    );
  }

  const { message, timeZone: requestedTz } = parsed.data;
  const timeZone = isValidTimeZone(requestedTz) ? requestedTz : serverTimeZone();
  const conversation = (await getConversation(id)) ?? newConversation();
  const skills = await listSkills();

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Client went away; keep going so the turn is saved consistently.
        }
      };
      const result: TurnResult = { ok: false, text: "", toolCalls: [] };
      try {
        for await (const event of runTurn({
          agent,
          skills,
          model,
          conversation,
          userText: message,
          timeZone,
          signal: abort.signal,
          result,
        })) {
          send(event);
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error(`Chat turn failed for ${agent.name}:`, err);
          send({ type: "error", message: describeError(err, model.name) });
        }
      }

      try {
        await saveConversation(id, conversation);
        const ask = message.length > 60 ? `${message.slice(0, 57)}…` : message;
        if (result.ok) {
          const tools = result.toolCalls.map((t) => `${t.label} (${t.summary})`).join(", ");
          await recordTurn(id, "chat", `Answered “${ask}”`, tools || undefined);
        } else if (!abort.signal.aborted) {
          await recordTurn(id, "error", `Couldn't finish “${ask}”`);
        }
      } finally {
        send({ type: "done" });
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
