import { CalendarDays, Camera, House, Mail, MessageCircle, ShoppingCart, Ticket, type LucideIcon } from "lucide-react";
import type { PluginIcon as PluginIconName } from "@/lib/plugins/catalog";

const ICONS: Record<PluginIconName, LucideIcon> = {
  calendar: CalendarDays,
  camera: Camera,
  cart: ShoppingCart,
  mail: Mail,
  home: House,
  ticket: Ticket,
  message: MessageCircle,
};

const TINTS: Record<PluginIconName, string> = {
  calendar: "bg-sky-50 text-sky-600 ring-sky-100",
  camera: "bg-rose-50 text-rose-600 ring-rose-100",
  cart: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  mail: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  home: "bg-amber-50 text-amber-600 ring-amber-100",
  ticket: "bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100",
  message: "bg-teal-50 text-teal-600 ring-teal-100",
};

export function PluginIcon({ icon, size = "md", muted = false }: { icon: PluginIconName; size?: "sm" | "md" | "lg"; muted?: boolean }) {
  const Icon = ICONS[icon];
  const box = size === "sm" ? "h-6 w-6 rounded-md" : size === "lg" ? "h-11 w-11 rounded-xl" : "h-8 w-8 rounded-lg";
  const glyph = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ring-1 ring-inset ${box} ${
        muted ? "bg-zinc-50 text-zinc-400 ring-zinc-100" : TINTS[icon]
      }`}
    >
      <Icon className={glyph} strokeWidth={2} />
    </span>
  );
}
