interface StampProps {
  label: string;
  tone: "amber" | "red" | "teal";
}

const TONE_STYLES = {
  amber: { border: "border-amber", text: "text-amber" },
  red: { border: "border-red", text: "text-red" },
  teal: { border: "border-teal", text: "text-teal" },
} as const;

/**
 * The signature element: a rotated, double-ruled badge styled like a rubber
 * ink stamp pressed onto a ledger page. Used for anything that needs to
 * read as "flagged" — low stock, reorder suggestions. Deliberately the one
 * place this UI takes a visual risk; everything else stays quiet and ruled.
 */
export function Stamp({ label, tone }: StampProps) {
  const styles = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border-2 ${styles.border} ${styles.text} px-2 py-0.5 -rotate-2 select-none`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.12em]">{label}</span>
    </span>
  );
}
