interface DetectionSourceTagProps {
  source?: string;
}

export function DetectionSourceTag({ source }: DetectionSourceTagProps) {
  if (!source) return null;

  const label =
    source === "LocalRules" ? "regras locais" :
    source === "DetectionService" ? "ML híbrido" :
    source === "LocalFallback" ? "fallback" :
    source;

  const className =
    source === "LocalRules"      ? "text-emerald-400/80" :
    source === "DetectionService" ? "text-sky-400/80" :
    source === "LocalFallback"    ? "text-amber-400/80" :
                                     "text-slate-400/80";

  return (
    <span className={`text-[10px] font-medium ${className}`}>
      via {label}
    </span>
  );
}
