interface MitreTagProps {
  techniqueId?: string;
  tactic?: string;
}

export function MitreTag({ techniqueId, tactic }: MitreTagProps) {
  if (!techniqueId) return null;

  return (
    <span
      title={tactic ? `${techniqueId} — ${tactic}` : techniqueId}
      className="inline-flex items-center rounded border border-[#2c83d4]/40 bg-[#0a6cff]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#62b4ff]"
    >
      {techniqueId}
    </span>
  );
}
