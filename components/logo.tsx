/** Four modules, one system. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`grid h-7 w-7 grid-cols-2 gap-[3px] ${className}`} aria-hidden>
      <span className="rounded-[4px] bg-sky-400" />
      <span className="rounded-[4px] bg-amber-400" />
      <span className="rounded-[4px] bg-emerald-400" />
      <span className="rounded-[4px] bg-zinc-900" />
    </span>
  );
}
