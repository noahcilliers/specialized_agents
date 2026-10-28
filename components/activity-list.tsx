import Link from "next/link";
import { AlertCircle, MessageSquare, Moon, Pencil, Plus, Sun } from "lucide-react";
import type { ActivityEntry, ActivityKind, Agent } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { AgentAvatar } from "./agent-avatar";

const KIND_ICON: Record<ActivityKind, typeof Sun> = {
  created: Plus,
  updated: Pencil,
  woke: Sun,
  slept: Moon,
  chat: MessageSquare,
  error: AlertCircle,
};

export function ActivityList({
  entries,
  agents,
  showAgent = true,
  empty = "Nothing yet. Activity shows up here as your agents work.",
}: {
  entries: ActivityEntry[];
  agents: Agent[];
  showAgent?: boolean;
  empty?: string;
}) {
  if (entries.length === 0) return <p className="px-1 py-6 text-center text-sm text-zinc-400">{empty}</p>;

  return (
    <ol className="space-y-1">
      {entries.map((e) => {
        const agent = agents.find((a) => a.id === e.agentId);
        const Icon = KIND_ICON[e.kind];
        return (
          <li key={e.id} className="flex gap-3 rounded-xl px-2 py-2.5">
            {showAgent && agent ? (
              <Link href={`/agents/${agent.id}`} className="pt-0.5">
                <AgentAvatar emoji={agent.emoji} color={agent.color} size="sm" />
              </Link>
            ) : (
              <span
                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  e.kind === "error" ? "bg-red-50 text-red-500" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 text-zinc-800">
                {e.kind === "error" ? <AlertCircle className="mr-1 inline h-3.5 w-3.5 text-red-500" /> : null}
                {e.summary}
              </p>
              {e.detail ? <p className="mt-0.5 truncate text-xs text-zinc-500">{e.detail}</p> : null}
              <p className="mt-0.5 text-xs text-zinc-400" title={e.at}>
                {showAgent && agent ? `${agent.name} · ` : ""}
                {timeAgo(e.at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
