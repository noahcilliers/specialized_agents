import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getAgent, getConversation, listActivity, listAgents, listSkills } from "@/lib/db";
import { getAllPluginStatuses } from "@/lib/plugins/runtime";
import { getPluginInfo } from "@/lib/plugins/catalog";
import { toDisplayMessages } from "@/lib/agent/display";
import { findModel, getOllamaStatus, OLLAMA_HOST, resolveModel, type OllamaStatus } from "@/lib/ollama";
import { modelLabel } from "@/lib/format";
import type { Agent } from "@/lib/types";
import { AgentAvatar } from "@/components/agent-avatar";
import { StatusToggle } from "@/components/status-toggle";
import { Chat } from "@/components/chat";
import { AgentForm } from "@/components/agent-form";
import { ActivityList } from "@/components/activity-list";
import { PluginIcon } from "@/components/plugin-icon";
import { Card, PageShell, Skeleton } from "@/components/ui";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "configure", label: "Configure" },
  { id: "activity", label: "Activity" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function AgentPage(props: PageProps<"/agents/[id]">) {
  return (
    <PageShell>
      <Suspense fallback={<AgentSkeleton />}>
        <AgentView {...props} />
      </Suspense>
    </PageShell>
  );
}

async function AgentView({ params, searchParams }: PageProps<"/agents/[id]">) {
  await connection();
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "chat";

  const [agent, ollama] = await Promise.all([getAgent(id), getOllamaStatus()]);
  if (!agent) notFound();

  const plugins = agent.pluginIds.map(getPluginInfo).filter((p) => p !== undefined);

  return (
    <>
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-3.5 w-3.5" /> All agents
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <AgentAvatar emoji={agent.emoji} color={agent.color} size="xl" status={agent.status} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{agent.name}</h1>
          <p className="mt-0.5 text-[15px] text-zinc-500">{agent.description || "No description yet."}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
            <span className="font-mono">{modelLabel(agent.model, ollama.defaultModel)}</span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {agent.skillIds.length} skill{agent.skillIds.length === 1 ? "" : "s"}
            </span>
            {plugins.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5">
                <PluginIcon icon={p.icon} size="sm" /> {p.name}
              </span>
            ))}
          </div>
        </div>
        <StatusToggle agentId={agent.id} status={agent.status} showLabel />
      </div>

      <nav className="mb-6 flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "chat" ? `/agents/${agent.id}` : `/agents/${agent.id}?tab=${t.id}`}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "chat" ? <ChatTab agent={agent} ollama={ollama} /> : null}
      {tab === "configure" ? <ConfigureTab agent={agent} ollama={ollama} /> : null}
      {tab === "activity" ? <ActivityTab agent={agent} /> : null}
    </>
  );
}

async function ChatTab({ agent, ollama }: { agent: Agent; ollama: OllamaStatus }) {
  const [conversation, statuses] = await Promise.all([getConversation(agent.id), getAllPluginStatuses()]);

  const notices: { text: string; href?: string; cta?: string }[] = [];
  const modelName = resolveModel(agent.model, ollama);
  const model = modelName ? findModel(ollama.models, modelName) : undefined;
  if (!ollama.running) {
    notices.push({ text: `Ollama isn't running at ${OLLAMA_HOST}. Open the Ollama app (or run \`ollama serve\`).` });
  } else if (!modelName) {
    notices.push({ text: "No local models installed. Run `ollama pull qwen3:8b` in a terminal." });
  } else if (!model) {
    notices.push({
      text: `${modelName} isn't installed. Run \`ollama pull ${modelName}\` or pick another model.`,
      href: `/agents/${agent.id}?tab=configure`,
      cta: "Change model",
    });
  } else if (agent.pluginIds.length && !model.tools) {
    notices.push({
      text: `${model.name} can't use tools, so this agent's plugins won't work.`,
      href: `/agents/${agent.id}?tab=configure`,
      cta: "Change model",
    });
  }
  const gcal = statuses["google-calendar"];
  if (agent.pluginIds.includes("google-calendar") && gcal && !gcal.connected) {
    notices.push({
      text: "Google Calendar isn't connected, so this agent can't read your schedule yet.",
      href: "/plugins",
      cta: "Connect",
    });
  }

  return (
    <Chat
      key={agent.id}
      agentId={agent.id}
      name={agent.name}
      emoji={agent.emoji}
      color={agent.color}
      status={agent.status}
      initialMessages={toDisplayMessages(conversation)}
      starters={startersFor(agent)}
      notices={notices}
      thinkingEnabled={Boolean(model?.thinking && agent.think)}
    />
  );
}

async function ConfigureTab({ agent, ollama }: { agent: Agent; ollama: OllamaStatus }) {
  const [skills, statuses] = await Promise.all([listSkills(), getAllPluginStatuses()]);
  const { name, emoji, color, description, systemPrompt, skillIds, pluginIds, model, think, status } = agent;
  return (
    <AgentForm
      mode="edit"
      agentId={agent.id}
      initial={{ name, emoji, color, description, systemPrompt, skillIds, pluginIds, model, think, status }}
      skills={skills}
      pluginStatuses={statuses}
      ollama={{ running: ollama.running, models: ollama.models, defaultModel: ollama.defaultModel }}
    />
  );
}

async function ActivityTab({ agent }: { agent: Agent }) {
  const [entries, agents] = await Promise.all([listActivity({ agentId: agent.id, limit: 100 }), listAgents()]);
  return (
    <Card className="max-w-2xl p-2">
      <ActivityList entries={entries} agents={agents} showAgent={false} empty={`${agent.name} hasn't done anything yet.`} />
    </Card>
  );
}

function startersFor(agent: Agent): string[] {
  const starters: string[] = [];
  if (agent.skillIds.includes("event-planning")) {
    starters.push("Find a free evening next week for dinner with friends");
  }
  if (agent.pluginIds.includes("google-calendar")) {
    starters.push("What's on my calendar today?", "Do I have any conflicts this week?", "When am I free tomorrow?");
  }
  if (agent.skillIds.includes("meal-planner")) starters.push("Plan three easy dinners for this week");
  if (agent.skillIds.includes("security-triage")) starters.push("What kinds of activity should you alert me about?");
  if (starters.length === 0) starters.push("What can you help me with?");
  return starters.slice(0, 3);
}

function AgentSkeleton() {
  return (
    <>
      <Skeleton className="mb-6 h-4 w-24" />
      <div className="mb-8 flex gap-4">
        <Skeleton className="h-16 w-16" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <Skeleton className="h-[520px]" />
    </>
  );
}
