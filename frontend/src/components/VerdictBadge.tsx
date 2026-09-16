import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

interface VerdictBadgeProps {
  verdict: "benign" | "suspicious" | "malicious" | string;
  size?: "sm" | "md";
}

export function VerdictBadge({ verdict, size = "sm" }: VerdictBadgeProps) {
  const v = verdict.toLowerCase();

  const config = {
    benign: {
      label: "Benign",
      icon: CheckCircle2,
      className: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/40",
    },
    suspicious: {
      label: "Suspicious",
      icon: AlertTriangle,
      className: "bg-amber-500/10 text-amber-300 ring-amber-500/40",
    },
    malicious: {
      label: "Malicious",
      icon: ShieldAlert,
      className: "bg-rose-500/10 text-rose-300 ring-rose-500/40",
    },
  }[v] ?? {
    label: v,
    icon: AlertTriangle,
    className: "bg-slate-500/10 text-slate-300 ring-slate-500/40",
  };

  const Icon = config.icon;
  const sizeClasses = size === "md"
    ? "px-3 py-1.5 text-xs gap-2"
    : "px-2 py-1 text-[10px] gap-1.5";

  return (
    <span className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wider ring-1 ${config.className} ${sizeClasses}`}>
      <Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {config.label}
    </span>
  );
}
