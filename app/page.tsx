import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CheckCircle2, Circle, Plus } from "lucide-react";
import { listActivity, listAgents } from "@/lib/db";
import { getPluginStatus } from "@/lib/plugins/runtime";
import { getOllamaStatus } from "@/lib/ollama";
import { greeting, plural } from "@/lib/format";
import { AgentCard } from "@/components/agent-card";
import { ActivityList } from "@/components/activity-list";
import { ButtonLink, Card, PageHeader, PageShell, SectionLabel, Skeleton } from "@/components/ui";

export default function HomePage() {
  return (
    <PageShell>
      <Suspense fallback={<HomeSkeleton />}>
        <Home />
      </Suspense>
    </PageShell>
  );
}

async function Home() {
  await connection();
  const [agents, activity, gcal, ollama] = await Promise.all([
    listAgents(),
    listActivity({ limit: 12 }),
    getPluginStatus("google-calendar"),
    getOllamaStatus(),
  ]);
  const running = agents.filter((a) => a.status === "running");
  const sleeping = agents.filter((a) => a.status === "sleeping");
  const usesCalendar = agents.some((a) => a.pluginIds.includes("google-calendar"));
  const code = (text: string) => <code className="rounded bg-zinc-100 px-1 font-mono text-xs">{text}</code>;

  const setup = [
    {
      done: ollama.running,
      title: "Start Ollama",
      body: <>Agents run on local models through Ollama. Open the Ollama app, or run {code("ollama serve")}.</>,
    },
    {
      done: ollama.running && ollama.models.some((m) => m.tools),
      title: "Install a model that can use tools",
      body: <>Run {code("ollama pull qwen3:8b")} (about 5 GB). Any model tagged &ldquo;tools&rdquo; works.</>,
    },
    ...(usesCalendar
      ? [
          {
            done: gcal.connected,
            title: "Connect Google Calendar",
            body: <>Your calendar agents need read access to answer questions about your schedule.</>,
            href: "/plugins",
          },
        ]
      : []),
  ];
  const setupLeft = setup.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader
        title={greeting()}
        description={
          agents.length
            ? `${plural(running.length, "agent")} running, ${sleeping.length} sleeping.`
            : "You don't have any agents yet."
        }
        actions={
          <ButtonLink href="/agents/new">
            <Plus className="h-4 w-4" /> New agent
          </ButtonLink>
        }
      />

      {setupLeft > 0 ? (
        <Card className="mb-8 overflow-hidden">
          <div className="border-b border-zinc-100 bg-amber-50/50 px-5 py-3">
            <p className="text-sm font-medium text-zinc-900">Finish setting up · {setupLeft} left</p>
          </div>
          <ul className="divide-y divide-zinc-100">
            {setup.map((s) => (
              <li key={s.title} className="flex items-start gap-3 px-5 py-3.5">
                {s.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${s.done ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{s.title}</p>
                  {!s.done ? <p className="mt-0.5 text-sm text-zinc-500">{s.body}</p> : null}
                </div>
                {!s.done && "href" in s && s.href ? (
                  <Link href={s.href} className="flex items-center gap-1 text-sm font-medium text-zinc-900 hover:underline">
                    Connect <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-9">
          {agents.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-14 text-center">
              <p className="text-lg font-semibold">Build your first agent</p>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                Give it one job, the skills it needs, and the plugins it can use.
              </p>
              <ButtonLink href="/agents/new" className="mt-5">
                <Plus className="h-4 w-4" /> New agent
              </ButtonLink>
            </Card>
          ) : null}

          {running.length ? (
            <section>
              <SectionLabel count={running.length}>Running</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                {running.map((a) => (
                  <AgentCard key={a.id} agent={a} defaultModel={ollama.defaultModel} />
                ))}
              </div>
            </section>
          ) : null}

          {sleeping.length ? (
            <section>
              <SectionLabel count={sleeping.length}>Sleeping</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                {sleeping.map((a) => (
                  <AgentCard key={a.id} agent={a} defaultModel={ollama.defaultModel} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside>
          <SectionLabel>Recent activity</SectionLabel>
          <Card className="p-2">
            <ActivityList entries={activity} agents={agents} />
          </Card>
        </aside>
      </div>
    </>
  );
}

function HomeSkeleton() {
  return (
    <>
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-10 h-5 w-72" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    </>
  );
}
