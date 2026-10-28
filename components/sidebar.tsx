"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Plug, Plus, Sparkles } from "lucide-react";
import { Logo } from "./logo";
import { AgentAvatar } from "./agent-avatar";
import type { AgentColor, AgentStatus } from "@/lib/types";

export interface SidebarAgent {
  id: string;
  name: string;
  emoji: string;
  color: AgentColor;
  status: AgentStatus;
}

const NAV = [
  { href: "/", label: "Home", icon: LayoutGrid },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/plugins", label: "Plugins", icon: Plug },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({ agents }: { agents: SidebarAgent[] }) {
  const pathname = usePathname();
  const running = agents.filter((a) => a.status === "running");
  const sleeping = agents.filter((a) => a.status === "sleeping");

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-white/70 px-3 py-5 backdrop-blur md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight text-zinc-900">Modular</span>
        </Link>

        <Link
          href="/agents/new"
          className="mb-5 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700"
        >
          <Plus className="h-4 w-4" /> New agent
        </Link>

        <nav className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive(pathname, href) ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-7 min-h-0 flex-1 overflow-y-auto">
          <AgentGroup title="Running" agents={running} pathname={pathname} />
          <AgentGroup title="Sleeping" agents={sleeping} pathname={pathname} />
        </div>

        <p className="px-2 pt-4 text-xs leading-relaxed text-zinc-400">
          One agent per job. Each gets only the skills and plugins it needs.
        </p>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <span className="font-semibold tracking-tight">Modular</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`rounded-lg p-2 ${isActive(pathname, href) ? "bg-zinc-100 text-zinc-900" : "text-zinc-500"}`}
            >
              <Icon className="h-4 w-4" />
            </Link>
          ))}
          <Link href="/agents/new" aria-label="New agent" className="rounded-lg bg-zinc-900 p-2 text-white">
            <Plus className="h-4 w-4" />
          </Link>
        </nav>
      </header>
    </>
  );
}

function AgentGroup({ title, agents, pathname }: { title: string; agents: SidebarAgent[]; pathname: string }) {
  if (agents.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
      <ul className="space-y-0.5">
        {agents.map((a) => {
          const active = pathname.startsWith(`/agents/${a.id}`);
          return (
            <li key={a.id}>
              <Link
                href={`/agents/${a.id}`}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                  active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <AgentAvatar emoji={a.emoji} color={a.color} size="xs" status={a.status} />
                <span className="truncate">{a.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
