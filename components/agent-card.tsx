import Link from "next/link";
import { Moon, Sparkles } from "lucide-react";
import type { Agent } from "@/lib/types";
import { getPluginInfo } from "@/lib/plugins/catalog";
import { modelLabel, timeAgo } from "@/lib/format";
import { AgentAvatar } from "./agent-avatar";
import { PluginIcon } from "./plugin-icon";
import { StatusToggle } from "./status-toggle";

export function AgentCard({ agent, defaultModel }: { agent: Agent; defaultModel: string | null }) {
  const plugins = agent.pluginIds.map(getPluginInfo).filter((p) => p !== undefined);
  const asleep = agent.status === "sleeping";

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border p-5 transition-all hover:-translate-y-px hover:shadow-md ${
        asleep ? "border-zinc-200/70 bg-white/60 hover:bg-white" : "border-zinc-200/80 bg-white shadow-xs"
      }`}
    >
      <Link href={`/agents/${agent.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${agent.name}`} />

      <div className="flex items-start gap-3.5">
        <AgentAvatar emoji={agent.emoji} color={agent.color} status={agent.status} />
        <div className="min-w-0 flex-1">
          <h3 className={`truncate font-semibold ${asleep ? "text-zinc-600" : "text-zinc-900"}`}>{agent.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
            {asleep ? (
              <>
                <Moon className="h-3 w-3" /> Sleeping
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Running
              </>
            )}
            <span className="text-zinc-300">·</span>
            <span className="truncate">{modelLabel(agent.model, defaultModel)}</span>
          </p>
        </div>
        <StatusToggle agentId={agent.id} status={agent.status} />
      </div>

      <p className={`mt-3.5 line-clamp-2 min-h-10 text-sm leading-5 ${asleep ? "text-zinc-400" : "text-zinc-600"}`}>
        {agent.description || "No description yet."}
      </p>

      <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-3.5 text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          {plugins.length ? (
            plugins.map((p) => (
              <span key={p.id} title={p.name}>
                <PluginIcon icon={p.icon} size="sm" muted={asleep} />
              </span>
            ))
          ) : (
            <span className="text-zinc-400">No plugins</span>
          )}
        </div>
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {agent.skillIds.length} skill{agent.skillIds.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto" title={agent.lastActiveAt ?? undefined}>
          {agent.lastActiveAt ? `Active ${timeAgo(agent.lastActiveAt)}` : "Not used yet"}
        </span>
      </div>
    </div>
  );
}
