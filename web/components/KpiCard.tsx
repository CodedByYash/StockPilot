interface KpiCardProps {
  label: string;
  value: string;
  tone?: "default" | "amber" | "red";
  hint?: string;
}

const TONE_TEXT: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-paper",
  amber: "text-amber",
  red: "text-red",
};

export function KpiCard({ label, value, tone = "default", hint }: KpiCardProps) {
  return (
    <div className="bg-surface border border-rule rounded-sm px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.15em] text-paper-dim mb-2">{label}</div>
      <div className={`text-3xl font-mono tabular-nums ${TONE_TEXT[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-paper-dim mt-1.5">{hint}</div>}
    </div>
  );
}
