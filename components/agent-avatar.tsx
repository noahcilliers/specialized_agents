import { AGENT_COLORS } from "@/lib/colors";
import type { AgentColor, AgentStatus } from "@/lib/types";

const SIZES = {
  xs: "h-6 w-6 text-[13px] rounded-md",
  sm: "h-8 w-8 text-base rounded-lg",
  md: "h-11 w-11 text-[22px] rounded-xl",
  lg: "h-14 w-14 text-[28px] rounded-2xl",
  xl: "h-16 w-16 text-[32px] rounded-2xl",
};

export function AgentAvatar({
  emoji,
  color,
  size = "md",
  status,
}: {
  emoji: string;
  color: AgentColor;
  size?: keyof typeof SIZES;
  status?: AgentStatus;
}) {
  const asleep = status === "sleeping";
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`inline-flex items-center justify-center ring-1 ring-inset ${AGENT_COLORS[color].tile} ${AGENT_COLORS[color].ring} ${SIZES[size]} ${asleep ? "grayscale-[60%] opacity-70" : ""}`}
        aria-hidden
      >
        {emoji}
      </span>
      {status ? (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${
            status === "running" ? "status-pulse bg-emerald-500" : "bg-zinc-300"
          }`}
          aria-label={status === "running" ? "Running" : "Sleeping"}
        />
      ) : null}
    </span>
  );
}
