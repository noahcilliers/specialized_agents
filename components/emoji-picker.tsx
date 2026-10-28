"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_COLORS } from "@/lib/colors";
import type { AgentColor } from "@/lib/types";

const EMOJIS = [
  "🤖", "📅", "🗓️", "⏰", "🛒", "🥗", "🍳", "🧺",
  "📹", "🛡️", "🔒", "🏠", "🎉", "✈️", "🎟️", "🎁",
  "💌", "📬", "💬", "📞", "💰", "📈", "🧾", "💡",
  "🌱", "🐶", "🧘", "🏃", "💊", "📚", "🎵", "🧹",
  "🚗", "🔧", "🧠", "⭐", "🦉", "🐝", "🌙", "☀️",
];

export function EmojiPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: AgentColor;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-16 w-16 items-center justify-center rounded-2xl text-[32px] ring-1 ring-inset transition-transform hover:scale-[1.03] ${AGENT_COLORS[color].tile} ${AGENT_COLORS[color].ring}`}
        aria-label="Choose an icon"
        aria-expanded={open}
      >
        {value}
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[296px] rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onChange(e);
                  setOpen(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-zinc-100 ${
                  e === value ? "bg-zinc-100 ring-1 ring-zinc-300" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Or type one
            <input
              className="h-8 w-16 rounded-md border border-zinc-200 text-center text-base outline-none focus:border-zinc-400"
              maxLength={8}
              defaultValue={EMOJIS.includes(value) ? "" : value}
              onChange={(ev) => ev.target.value.trim() && onChange(ev.target.value.trim())}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
