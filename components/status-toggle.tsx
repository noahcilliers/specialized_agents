"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AgentStatus } from "@/lib/types";

/** Running/sleeping switch. Sleeping agents don't respond until woken. */
export function StatusToggle({
  agentId,
  status,
  showLabel = false,
}: {
  agentId: string;
  status: AgentStatus;
  showLabel?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(status);
  const running = optimistic === "running";

  function toggle() {
    const next: AgentStatus = running ? "sleeping" : "running";
    startTransition(async () => {
      setOptimistic(next);
      await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={running}
      aria-label={running ? "Put agent to sleep" : "Wake agent up"}
      title={running ? "Running · click to put to sleep" : "Sleeping · click to wake up"}
      onClick={toggle}
      disabled={pending}
      className="group relative z-10 inline-flex items-center gap-2 disabled:cursor-wait"
    >
      {showLabel ? (
        <span className={`text-sm font-medium ${running ? "text-emerald-700" : "text-zinc-500"}`}>
          {running ? "Running" : "Sleeping"}
        </span>
      ) : null}
      <span
        className={`relative inline-flex h-[22px] w-[38px] items-center rounded-full transition-colors ${
          running ? "bg-emerald-500" : "bg-zinc-300 group-hover:bg-zinc-400"
        }`}
      >
        <span
          className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
            running ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>
    </button>
  );
}
