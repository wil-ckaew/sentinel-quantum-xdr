interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const s = severity.toLowerCase();

  const className =
    s === "critical" ? "bg-rose-500/15 text-rose-300 ring-rose-500/40" :
    s === "high"     ? "bg-orange-500/15 text-orange-300 ring-orange-500/40" :
    s === "medium"   ? "bg-amber-500/15 text-amber-300 ring-amber-500/40" :
    s === "low"      ? "bg-sky-500/15 text-sky-300 ring-sky-500/40" :
                       "bg-slate-500/15 text-slate-300 ring-slate-500/40";

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${className}`}>
      {s}
    </span>
  );
}
