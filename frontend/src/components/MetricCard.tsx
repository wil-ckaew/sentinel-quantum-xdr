import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext: string;
  color?: string;
  icon?: LucideIcon;
}

export function MetricCard({ title, value, subtext, color = "border-slate-700/80", icon: Icon }: MetricCardProps) {
  return (
    <div className={`group relative min-h-[160px] overflow-hidden rounded-[26px] border bg-slate-900/75 ${color} p-5 shadow-[0_18px_45px_rgba(15,23,42,0.6)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-sky-400/60`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_36%)]" />
      <div className="relative flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</p>
            <p className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-white">{value}</p>
          </div>
          {Icon ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
        <span className="text-xs text-slate-400">{subtext}</span>
      </div>
    </div>
  );
}
