const STATUS_STYLES: Record<string, string> = {
  draft: "text-paper-dim border-rule",
  pending: "text-paper-dim border-rule",
  ordered: "text-amber border-amber",
  partially_received: "text-amber border-amber",
  partially_fulfilled: "text-amber border-amber",
  received: "text-teal border-teal",
  fulfilled: "text-teal border-teal",
  cancelled: "text-red border-red",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "text-paper-dim border-rule";
  return (
    <span className={`inline-block text-[10px] uppercase tracking-wide border rounded-sm px-2 py-0.5 font-mono ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
